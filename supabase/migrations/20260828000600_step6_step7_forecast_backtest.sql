create schema if not exists core;
create schema if not exists analytics;
create extension if not exists pgcrypto;

alter table core.forecast_setting add column if not exists forecast_horizon integer not null default 6 check (forecast_horizon > 0);
alter table core.forecast_setting add column if not exists champion_metric text not null default 'WAPE' check (champion_metric in ('WAPE','RMSE','MAE'));
alter table core.forecast_setting add column if not exists reference_model_id text not null default 'MA_3M';

create table if not exists core.model_config (
  model_id text primary key,
  model_name text not null,
  family text not null,
  engine text not null,
  version text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  applicable_demand_type text[] not null default array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'],
  parameters jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists core.model_version (
  model_version_id uuid primary key default gen_random_uuid(),
  model_id text not null,
  version text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists core.forecast_run (
  run_id uuid primary key default gen_random_uuid(), status text not null check (status in ('RUNNING','SUCCESS','FAILED')),
  granularity text not null, train_start date, train_end date, horizon integer not null,
  champion_metric text, data_snapshot_at timestamptz not null, models jsonb not null default '[]'::jsonb,
  n_models integer not null default 0, n_items integer not null default 0, n_rows integer not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz, duration_ms bigint,
  triggered_by uuid references auth.users(id), triggered_email text, note text, message text
);

create table if not exists core.forecast_result (
  run_id uuid not null references core.forecast_run(run_id) on delete cascade,
  model_id text not null, item_id text not null, period date not null,
  model_version text not null, predicted_qty numeric, p50 numeric, p80 numeric, p90 numeric, sigma numeric,
  basis text not null, primary key (run_id, model_id, item_id, period)
);

create table if not exists core.backtest_run (
  backtest_run_id uuid primary key default gen_random_uuid(), forecast_run_id uuid not null references core.forecast_run(run_id),
  test_start date, test_end date, metric text not null default 'WAPE', status text not null check (status in ('RUNNING','SUCCESS','FAILED')),
  started_at timestamptz not null default now(), finished_at timestamptz, triggered_by uuid references auth.users(id), message text
);

create table if not exists core.model_performance (
  performance_id uuid primary key default gen_random_uuid(), run_id uuid, backtest_run_id uuid not null references core.backtest_run(backtest_run_id) on delete cascade,
  forecast_run_id uuid not null references core.forecast_run(run_id), model_id text not null, model_version text not null, item_id text not null,
  n_periods integer not null default 0, wape numeric, mape numeric, bias numeric, rmse numeric, mae numeric, baseline_improvement numeric,
  rank integer, calculation_status text not null default 'SUCCESS', reason_code text, calculated_at timestamptz not null default now(),
  unique(backtest_run_id, model_id, item_id)
);

create table if not exists core.champion_model (
  champion_id uuid primary key default gen_random_uuid(), backtest_run_id uuid references core.backtest_run(backtest_run_id), item_id text not null,
  champion_model_id text, model_version text, champion_metric text not null, champion_metric_value numeric,
  wape numeric, mape numeric, bias numeric, rmse numeric, candidate_performance jsonb not null default '[]'::jsonb,
  selection_reason text, selection_method text not null check (selection_method in ('AUTO','MANUAL')),
  reason_code text, selected_at timestamptz not null default now(), selected_by uuid references auth.users(id)
);
alter table core.model_performance add column if not exists run_id uuid;

insert into core.model_config(model_id,model_name,family,engine,version,is_default,parameters,description) values
 ('MA_3M','3개월 이동평균','MOVING_AVERAGE','SQL_BASELINE','1.0.0',true,'{"window":3}'::jsonb,'최근 3개월 평균'),
 ('MA_6M','6개월 이동평균','MOVING_AVERAGE','SQL_BASELINE','1.0.0',false,'{"window":6}'::jsonb,'최근 6개월 평균'),
 ('WMA_3M','3개월 가중 이동평균','WEIGHTED_MOVING_AVERAGE','SQL_BASELINE','1.0.0',false,'{"window":3,"weights":[3,2,1]}'::jsonb,'최근순 3:2:1 가중치'),
 ('PY_SAME_MONTH','전년 동월','SEASONAL_NAIVE','SQL_BASELINE','1.0.0',false,'{"lag_periods":12}'::jsonb,'12개월 전 동월'),
 ('SEASONAL_NAIVE','계절성 나이브','SEASONAL_NAIVE','SQL_BASELINE','1.0.0',false,'{"lag_periods":12}'::jsonb,'12개월 전 동일 기간')
on conflict (model_id) do nothing;

create or replace function core.run_baseline_forecast()
returns uuid language plpgsql security definer set search_path = core, public
as $$
declare v_run uuid := gen_random_uuid(); v_started timestamptz := clock_timestamp(); v_snapshot timestamptz := clock_timestamp(); v_setting core.forecast_setting; v_models jsonb; v_rows integer; v_items integer; v_error text;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_setting from core.forecast_setting where setting_id='default';
  insert into core.forecast_run(run_id,status,granularity,train_start,train_end,horizon,champion_metric,data_snapshot_at,triggered_by,triggered_email)
  values(v_run,'RUNNING',v_setting.granularity,v_setting.train_start,v_setting.train_end,v_setting.forecast_horizon,v_setting.champion_metric,v_snapshot,auth.uid(),(select email from core.app_user where user_id=auth.uid()));
  begin
    if v_setting.train_start is null or v_setting.train_end is null then raise exception 'TRAIN_WINDOW_UNAVAILABLE'; end if;
    insert into core.model_version(model_id,version,definition,created_by)
    select model_id,version,jsonb_build_object('model_id',model_id,'model_name',model_name,'family',family,'engine',engine,'version',version,'parameters',parameters,'applicable_demand_type',applicable_demand_type),auth.uid()
    from core.model_config where enabled;
    with train as (
      select item_id,date_trunc('month',demand_date)::date as period,sum(qty) filter(where qty > 0)::numeric as quantity
      from core.v_train_demand group by item_id,date_trunc('month',demand_date)
    ), settings as (select date_trunc('month',v_setting.train_start)::date as first_period,date_trunc('month',v_setting.train_end)::date as last_period),
    items as (select item_id from analytics.v_sku_demand_profile), grid as (
      select i.item_id,gs::date as period,row_number() over(partition by i.item_id order by gs)::integer as period_no
      from items i cross join settings s cross join generate_series(s.first_period,s.last_period,interval '1 month') gs
    ), monthly as (select g.item_id,g.period,g.period_no,coalesce(t.quantity,0)::numeric quantity from grid g left join train t using(item_id,period)),
    numbered as (select m.*,max(period_no) over(partition by item_id) max_period from monthly m),
    future as (select i.item_id,(date_trunc('month',v_setting.train_end)+(h.n||' months')::interval)::date period,h.n+(select max(period_no) from monthly where item_id=i.item_id) future_no from items i cross join lateral generate_series(1,v_setting.forecast_horizon) h(n)),
    enabled_models as (select m.*,mv.version snapshot_version from core.model_config m join (select distinct on(model_id) model_id,version from core.model_version where created_at >= v_started order by model_id,created_at desc) mv using(model_id) where m.enabled),
    predictions as (
      select em.model_id,em.snapshot_version,f.item_id,f.period,
        case when em.model_id in ('MA_3M','MA_6M') then (select case when count(*)=(em.parameters->>'window')::integer then avg(n.quantity) end from numbered n where n.item_id=f.item_id and n.period_no between f.future_no-(em.parameters->>'window')::integer and f.future_no-1)
        when em.model_id='WMA_3M' then (select case when count(*)=3 then sum(n.quantity*(w.weight)::numeric)/sum((w.weight)::numeric) end from numbered n join lateral jsonb_array_elements_text(em.parameters->'weights') with ordinality w(weight,offset_no) on n.period_no=f.future_no-w.offset_no::integer where n.item_id=f.item_id)
        else (select n.quantity from numbered n where n.item_id=f.item_id and n.period_no=f.future_no-(em.parameters->>'lag_periods')::integer) end predicted_qty,
        em.model_id as basis_model
      from enabled_models em cross join future f
      left join analytics.v_sku_demand_profile dp on dp.item_id=f.item_id
      where dp.demand_type is null or cardinality(em.applicable_demand_type)=0 or dp.demand_type=any(em.applicable_demand_type)
    ), fitted as (
      select em.model_id,n.item_id,n.period_no,n.quantity,
        case when em.model_id in ('MA_3M','MA_6M') then (select case when count(*)=(em.parameters->>'window')::integer then avg(p.quantity) end from numbered p where p.item_id=n.item_id and p.period_no between n.period_no-(em.parameters->>'window')::integer and n.period_no-1)
        when em.model_id='WMA_3M' then (select case when count(*)=3 then sum(p.quantity*(w.weight)::numeric)/sum((w.weight)::numeric) end from numbered p join lateral jsonb_array_elements_text(em.parameters->'weights') with ordinality w(weight,offset_no) on p.period_no=n.period_no-w.offset_no::integer where p.item_id=n.item_id)
        else (select p.quantity from numbered p where p.item_id=n.item_id and p.period_no=n.period_no-(em.parameters->>'lag_periods')::integer) end fitted_qty
      from enabled_models em cross join numbered n
    ), sigma as (select model_id,item_id,stddev_samp(quantity-fitted_qty) filter(where fitted_qty is not null)::numeric sigma from fitted group by model_id,item_id)
    insert into core.forecast_result(run_id,model_id,item_id,period,model_version,predicted_qty,p50,p80,p90,sigma,basis)
    select v_run,p.model_id,p.item_id,p.period,p.snapshot_version,p.predicted_qty,p.predicted_qty,
      case when s.sigma is null or p.predicted_qty is null then null else p.predicted_qty+0.841621*s.sigma end,
      case when s.sigma is null or p.predicted_qty is null then null else p.predicted_qty+1.281552*s.sigma end,
      s.sigma,case when p.predicted_qty is null then 'CALCULATION_UNAVAILABLE' else 'SQL_BASELINE' end
    from predictions p left join sigma s using(model_id,item_id);
    select coalesce(jsonb_agg(jsonb_build_object('model_id',model_id,'version',snapshot_version)),'[]'::jsonb) into v_models from (select distinct model_id,snapshot_version from core.forecast_result where run_id=v_run) m;
    update core.forecast_run set status='SUCCESS',models=v_models,n_models=(select count(distinct model_id) from core.forecast_result where run_id=v_run),n_items=(select count(distinct item_id) from core.forecast_result where run_id=v_run),n_rows=(select count(*) from core.forecast_result where run_id=v_run),finished_at=clock_timestamp(),duration_ms=(extract(epoch from(clock_timestamp()-v_started))*1000)::bigint,message='Baseline Forecast 완료' where run_id=v_run;
  exception when others then
    get stacked diagnostics v_error = message_text;
    update core.forecast_run set status='FAILED',finished_at=clock_timestamp(),duration_ms=(extract(epoch from(clock_timestamp()-v_started))*1000)::bigint,message=v_error where run_id=v_run;
  end;
  return v_run;
end;
$$;

create or replace function core.run_backtest(p_forecast_run_id uuid)
returns uuid language plpgsql security definer set search_path = core, public
as $$
declare v_id uuid := gen_random_uuid(); v_setting core.forecast_setting; v_error text;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_setting from core.forecast_setting where setting_id='default';
  insert into core.backtest_run(backtest_run_id,forecast_run_id,test_start,test_end,metric,triggered_by) values(v_id,p_forecast_run_id,v_setting.test_start,v_setting.test_end,v_setting.champion_metric,auth.uid());
  begin
    with actual as (select item_id,date_trunc('month',actual_date)::date period,coalesce(sum(qty) filter(where qty > 0),0)::numeric actual_qty from core.v_test_actual group by item_id,date_trunc('month',actual_date)),
    pairs as (select fr.model_id,fr.model_version,fr.item_id,fr.period,fr.predicted_qty,a.actual_qty,fr.predicted_qty-a.actual_qty error from core.forecast_result fr left join actual a using(item_id,period) where fr.run_id=p_forecast_run_id and fr.period between v_setting.test_start and v_setting.test_end),
    metric as (select model_id,model_version,item_id,count(*) filter(where predicted_qty is not null and actual_qty is not null)::integer n_periods,sum(actual_qty) filter(where predicted_qty is not null and actual_qty is not null) actual_sum,avg(abs(error)) filter(where predicted_qty is not null and actual_qty is not null) mae,avg(error) filter(where predicted_qty is not null and actual_qty is not null) bias,sqrt(avg(error*error) filter(where predicted_qty is not null and actual_qty is not null)) rmse,sum(abs(error)) filter(where predicted_qty is not null and actual_qty is not null) abs_error,sum(abs(error)/nullif(actual_qty,0)) filter(where predicted_qty is not null and actual_qty > 0) mape_sum,count(*) filter(where predicted_qty is not null and actual_qty > 0) mape_n from pairs group by model_id,model_version,item_id),
    ranked as (select *,case when actual_sum=0 then null else abs_error/actual_sum end wape,case when mape_n=0 then null else mape_sum/mape_n end mape_calc from metric)
    insert into core.model_performance(run_id,backtest_run_id,forecast_run_id,model_id,model_version,item_id,n_periods,wape,mape,bias,rmse,mae,rank,calculation_status,reason_code)
    select v_id,v_id,p_forecast_run_id,model_id,model_version,item_id,n_periods,wape,mape_calc,bias,rmse,mae,
      case when wape is null then null else row_number() over(partition by item_id order by wape asc,abs(bias) asc nulls last,rmse asc nulls last,model_id) end::integer,
      case when n_periods=0 then 'UNAVAILABLE' when actual_sum=0 then 'UNAVAILABLE' when mape_n=0 then 'PARTIAL' else 'SUCCESS' end,
      case when n_periods=0 then 'NO_COMPARABLE_PERIODS' when actual_sum=0 then 'ACTUAL_SUM_ZERO' when mape_n=0 then 'ACTUAL_ZERO_ONLY' else null end
    from ranked;
    update core.model_performance p set baseline_improvement=case when ref.wape is null or ref.wape=0 or p.wape is null then null else (ref.wape-p.wape)/ref.wape end from core.model_performance ref where p.backtest_run_id=v_id and ref.backtest_run_id=v_id and ref.item_id=p.item_id and ref.model_id=v_setting.reference_model_id;
    insert into core.champion_model(backtest_run_id,item_id,champion_model_id,model_version,champion_metric,champion_metric_value,wape,mape,bias,rmse,candidate_performance,selection_reason,selection_method,reason_code,selected_by)
    select v_id,p.item_id,p.model_id,p.model_version,v_setting.champion_metric,p.wape,p.wape,p.mape,p.bias,p.rmse,
      (select coalesce(jsonb_agg(jsonb_build_object('model_id',c.model_id,'model_version',c.model_version,'WAPE',c.wape,'MAPE',c.mape,'Bias',c.bias,'RMSE',c.rmse,'MAE',c.mae,'rank',c.rank) order by c.rank nulls last,c.model_id),'[]'::jsonb) from core.model_performance c where c.backtest_run_id=v_id and c.item_id=p.item_id),
      'WAPE 오름차순, 절대 Bias, RMSE, model_id 순으로 선택','AUTO',null,auth.uid()
    from core.model_performance p where p.backtest_run_id=v_id and p.rank=1;
    update core.backtest_run set status='SUCCESS',finished_at=clock_timestamp() where backtest_run_id=v_id;
  exception when others then get stacked diagnostics v_error=message_text; update core.backtest_run set status='FAILED',finished_at=clock_timestamp(),message=v_error where backtest_run_id=v_id; end;
  return v_id;
end;
$$;

create or replace function core.set_manual_champion(p_item_id text,p_model_id text,p_backtest_run_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = core, public
as $$
declare v_id uuid; p core.model_performance;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'MANUAL_REASON_REQUIRED'; end if;
  select * into p from core.model_performance where backtest_run_id=p_backtest_run_id and item_id=p_item_id and model_id=p_model_id limit 1;
  if p.performance_id is null then raise exception 'MODEL_PERFORMANCE_NOT_FOUND'; end if;
  insert into core.champion_model(backtest_run_id,item_id,champion_model_id,model_version,champion_metric,champion_metric_value,wape,mape,bias,rmse,candidate_performance,selection_reason,selection_method,reason_code,selected_by)
  values(p_backtest_run_id,p_item_id,p_model_id,p.model_version,'WAPE',p.wape,p.wape,p.mape,p.bias,p.rmse,(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from core.model_performance c where c.backtest_run_id=p_backtest_run_id and c.item_id=p_item_id),p_reason,'MANUAL','MANUAL_REASON_REQUIRED',auth.uid()) returning champion_id into v_id;
  insert into core.audit_log(actor,action,target_type,target_id,before,after) values(auth.uid(),'CHAMPION_MANUAL_SET','champion_model',p_item_id,null,jsonb_build_object('model_id',p_model_id,'reason',p_reason));
  return v_id;
end;
$$;

create or replace view analytics.v_model_config as select model_id,model_name,family,engine,version,enabled,is_default,applicable_demand_type,parameters,description,updated_at from core.model_config;
create or replace view analytics.v_forecast_run as
select r.*,exists(select 1 from core.upload_batch b where b.forecast_stale and b.status='IMPORTED' and b.imported_at > r.data_snapshot_at) as is_stale
from core.forecast_run r;
create or replace view analytics.v_forecast_result as select * from core.forecast_result;
create or replace view analytics.v_backtest_run as select * from core.backtest_run;
create or replace view analytics.v_model_performance as select * from core.model_performance;
create or replace view analytics.v_champion_model as select distinct on(item_id) * from core.champion_model order by item_id,selected_at desc;
create or replace view analytics.v_forecast_comparison as
with actual as (select item_id,date_trunc('month',actual_date)::date period,coalesce(sum(qty) filter(where qty > 0),0)::numeric actual_qty from core.v_test_actual group by item_id,date_trunc('month',actual_date))
select fr.run_id,fr.model_id,fr.item_id,fr.period,fr.model_version,fr.predicted_qty,fr.p50,fr.p80,fr.p90,fr.sigma,fr.basis,a.actual_qty
from core.forecast_result fr left join actual a using(item_id,period);
create or replace view analytics.v_forecast_run_kpi as select status,count(*)::integer n_runs,count(*) filter(where status='SUCCESS')::integer n_success,count(*) filter(where is_stale)::integer n_stale from analytics.v_forecast_run group by status;

comment on table core.model_performance is 'WAPE=sum(abs(predicted-actual))/sum(actual), Actual 합계 0이면 NULL. MAPE는 Actual>0 기간만 평균하며 0 분모는 제외하고 모두 0이면 NULL. Bias=predicted-actual, 양수는 과대예측.';
comment on table core.champion_model is 'AUTO Champion은 WAPE 오름차순, 절대 Bias, RMSE, model_id 순으로 선택하며 후보 전체를 candidate_performance에 보존한다.';

alter table core.model_config enable row level security; alter table core.model_version enable row level security; alter table core.forecast_run enable row level security; alter table core.forecast_result enable row level security; alter table core.backtest_run enable row level security; alter table core.model_performance enable row level security; alter table core.champion_model enable row level security;
drop policy if exists model_config_select on core.model_config; create policy model_config_select on core.model_config for select to authenticated using (true);
drop policy if exists model_config_admin on core.model_config; create policy model_config_admin on core.model_config for all to authenticated using(core.is_admin()) with check(core.is_admin());
drop policy if exists forecast_run_select on core.forecast_run; create policy forecast_run_select on core.forecast_run for select to authenticated using(true);
drop policy if exists forecast_result_select on core.forecast_result; create policy forecast_result_select on core.forecast_result for select to authenticated using(true);
drop policy if exists backtest_run_select on core.backtest_run; create policy backtest_run_select on core.backtest_run for select to authenticated using(true);
drop policy if exists performance_select on core.model_performance; create policy performance_select on core.model_performance for select to authenticated using(true);
drop policy if exists champion_select on core.champion_model; create policy champion_select on core.champion_model for select to authenticated using(true);

grant usage on schema core,analytics to authenticated;
grant update on core.model_config to authenticated;
grant select on analytics.v_model_config,analytics.v_forecast_run,analytics.v_forecast_result,analytics.v_backtest_run,analytics.v_model_performance,analytics.v_champion_model,analytics.v_forecast_comparison,analytics.v_forecast_run_kpi to authenticated;
grant execute on function core.run_baseline_forecast(),core.run_backtest(uuid),core.set_manual_champion(text,text,uuid,text) to authenticated;

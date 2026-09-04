create schema if not exists core;
create schema if not exists analytics;
create extension if not exists pgcrypto;

-- 기존 core.leadtime_plan은 호환을 위해 유지하고, 품목별 확정값과 이력을 별도 관리합니다.
create table if not exists core.leadtime_policy (
  policy_id uuid primary key default gen_random_uuid(),
  item_id text,
  supplier_id text not null,
  confirmed_lead_time integer not null check (confirmed_lead_time > 0),
  effective_from date not null default current_date,
  effective_to date,
  confirmed_reason text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  check (effective_to is null or effective_from <= effective_to)
);

create table if not exists core.leadtime_policy_history (
  history_id uuid primary key default gen_random_uuid(),
  policy_id uuid,
  item_id text,
  supplier_id text not null,
  before_value integer,
  after_value integer,
  effective_from date not null,
  reason text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create table if not exists core.soft_allocation (
  allocation_id uuid primary key default gen_random_uuid(),
  item_id text not null,
  allocation_date date not null,
  qty numeric not null check (qty >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','CANCELLED')),
  source_record_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

insert into core.policy_config(policy_id, settings)
values ('default', '{"period_days":30,"critical_buffer_days":0,"confirmed_sales_statuses":["CONFIRMED","확정","확정수주"]}'::jsonb)
on conflict (policy_id) do update set settings = coalesce(core.policy_config.settings, '{}'::jsonb) || excluded.settings;

create or replace function core.set_leadtime_policy(
  p_item_id text,
  p_supplier_id text,
  p_confirmed_lead_time integer,
  p_reason text,
  p_effective_from date default current_date
) returns uuid
language plpgsql security definer set search_path = core, public
as $$
declare
  v_id uuid;
  v_before integer;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_supplier_id is null or p_confirmed_lead_time is null or p_confirmed_lead_time <= 0 then raise exception 'INVALID_LEADTIME'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'LEADTIME_REASON_REQUIRED'; end if;
  select confirmed_lead_time into v_before
  from core.leadtime_policy
  where supplier_id = p_supplier_id and coalesce(item_id, '') = coalesce(nullif(trim(p_item_id), ''), '') and effective_to is null
  order by effective_from desc, changed_at desc limit 1;
  update core.leadtime_policy set effective_to = p_effective_from - 1 where supplier_id = p_supplier_id and coalesce(item_id, '') = coalesce(nullif(trim(p_item_id), ''), '') and effective_to is null and effective_from < p_effective_from;
  insert into core.leadtime_policy(item_id, supplier_id, confirmed_lead_time, effective_from, confirmed_reason, changed_by)
  values(nullif(trim(p_item_id), ''), p_supplier_id, p_confirmed_lead_time, p_effective_from, p_reason, auth.uid()) returning policy_id into v_id;
  insert into core.leadtime_policy_history(policy_id,item_id,supplier_id,before_value,after_value,effective_from,reason,changed_by)
  values(v_id,nullif(trim(p_item_id),''),p_supplier_id,v_before,p_confirmed_lead_time,p_effective_from,p_reason,auth.uid());
  insert into core.audit_log(actor, action, target_type, target_id, before, after)
  values(auth.uid(),'LEADTIME_POLICY_CHANGED','leadtime_policy',v_id::text,jsonb_build_object('lead_time',v_before),jsonb_build_object('item_id',p_item_id,'supplier_id',p_supplier_id,'lead_time',p_confirmed_lead_time,'effective_from',p_effective_from,'reason',p_reason));
  return v_id;
end;
$$;

create or replace view core.v_leadtime_effective as
with stats as (
  select supplier_id, supplier_name, country, n_samples, p50_days, p80_days, p90_days, mean_days
  from core.v_leadtime_stat
), suppliers as (
  select "공급업체코드" supplier_id, "공급업체명" supplier_name, "국가" country
  from raw.supplier_master where "사용여부" = 'Y'
), current_policy as (
  select distinct on (supplier_id, item_id) supplier_id, item_id, confirmed_lead_time, effective_from, changed_by, changed_at
  from core.leadtime_policy
  where item_id is null and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
  order by supplier_id, item_id, effective_from desc, changed_at desc
)
select s.supplier_id, s.supplier_name, s.country, st.n_samples, st.p80_days,
       p.confirmed_lead_time as planned_lead_time, coalesce(p.confirmed_lead_time, st.p80_days) as effective_lead_time,
       case when p.confirmed_lead_time is not null then '확정값' else '실적 P80' end as source,
       st.p50_days, st.p90_days, case when p.confirmed_lead_time is not null then 'ADMIN_CONFIRMED' else 'ACTUAL_P80' end as effective_source,
       p.effective_from, p.changed_by, p.changed_at
from suppliers s
left join stats st using (supplier_id)
left join current_policy p using (supplier_id);

create or replace view analytics.v_leadtime_policy as
with items as (
  select item_id, item_name, supplier_id from core.v_item_master where is_active = 'Y'
), stats as (
  select supplier_id, supplier_name, country, n_samples, p50_days, p80_days, p90_days, mean_days
  from core.v_leadtime_stat
), policies as (
  select distinct on (supplier_id, item_id) supplier_id, item_id, confirmed_lead_time, effective_from, changed_by, changed_at, confirmed_reason
  from core.leadtime_policy
  where effective_from <= current_date and (effective_to is null or effective_to >= current_date)
  order by supplier_id, item_id, effective_from desc, changed_at desc
), supplier_policies as (
  select distinct on (supplier_id) supplier_id, confirmed_lead_time, effective_from, changed_by, changed_at, confirmed_reason
  from core.leadtime_policy
  where item_id is null and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
  order by supplier_id, effective_from desc, changed_at desc
)
select i.item_id, i.item_name, i.supplier_id, s.supplier_name, s.country, st.n_samples, st.mean_days, st.p50_days, st.p80_days, st.p90_days,
       ip.confirmed_lead_time as item_confirmed_lead_time, sp.confirmed_lead_time as supplier_confirmed_lead_time,
       coalesce(ip.confirmed_lead_time, sp.confirmed_lead_time, st.p80_days) as effective_lead_time,
       case when ip.confirmed_lead_time is not null then 'ITEM_ADMIN_CONFIRMED' when sp.confirmed_lead_time is not null then 'SUPPLIER_ADMIN_CONFIRMED' when st.p80_days is not null then 'ACTUAL_P80' else 'UNAVAILABLE' end as effective_source,
       coalesce(ip.effective_from, sp.effective_from) as effective_from, coalesce(ip.changed_by, sp.changed_by) as changed_by,
       coalesce(ip.changed_at, sp.changed_at) as changed_at, coalesce(ip.confirmed_reason, sp.confirmed_reason) as confirmed_reason
from items i left join raw.supplier_master s on s."공급업체코드"=i.supplier_id left join stats st using(supplier_id)
left join policies ip on ip.item_id=i.item_id and ip.supplier_id=i.supplier_id
left join supplier_policies sp on sp.supplier_id=i.supplier_id;

grant execute on function core.set_leadtime_policy(text,text,integer,text,date) to authenticated;
grant usage on schema core, analytics to authenticated;
grant select on core.leadtime_policy, core.leadtime_policy_history, core.soft_allocation to authenticated;
grant insert, update, delete on core.leadtime_policy, core.soft_allocation to authenticated;

alter table core.leadtime_policy enable row level security;
alter table core.leadtime_policy_history enable row level security;
alter table core.soft_allocation enable row level security;
drop policy if exists leadtime_policy_select on core.leadtime_policy;
create policy leadtime_policy_select on core.leadtime_policy for select to authenticated using (true);
drop policy if exists leadtime_policy_admin on core.leadtime_policy;
create policy leadtime_policy_admin on core.leadtime_policy for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists leadtime_history_admin on core.leadtime_policy_history;
create policy leadtime_history_admin on core.leadtime_policy_history for select to authenticated using (core.is_admin());
drop policy if exists soft_allocation_select on core.soft_allocation;
create policy soft_allocation_select on core.soft_allocation for select to authenticated using (true);
drop policy if exists soft_allocation_admin on core.soft_allocation;
create policy soft_allocation_admin on core.soft_allocation for all to authenticated using (core.is_admin()) with check (core.is_admin());

create or replace view analytics.v_inventory_projection as
with recursive config as (
  select (settings->>'period_days')::numeric period_days, (settings->>'critical_buffer_days')::numeric critical_buffer_days,
         coalesce(settings->'confirmed_sales_statuses','[]'::jsonb) confirmed_sales_statuses
  from core.policy_config where policy_id='default'
), forecast_ranked as (
  select fr.item_id, fr.period, fr.predicted_qty, fr.model_id, fr.model_version, r.finished_at,
         row_number() over (partition by fr.item_id, fr.period order by case when cm.champion_model_id=fr.model_id then 0 else 1 end, r.finished_at desc nulls last, fr.model_id) rn
  from core.forecast_result fr join core.forecast_run r on r.run_id=fr.run_id and r.status='SUCCESS'
  left join lateral (select champion_model_id from core.champion_model c where c.item_id=fr.item_id order by c.selected_at desc limit 1) cm on true
), forecasts as (
  select item_id, period, predicted_qty forecast_demand, model_id, model_version from forecast_ranked where rn=1
), items as (
  select item_id, item_name, supplier_id from core.v_item_master where is_active='Y'
), inventory as (
  select i.item_id, st.current_stock available_inventory from items i left join core.v_stock_on_hand st using(item_id)
), receipts as (
  select upper(regexp_replace("품목코드", '[\s\-_]', '', 'g')) item_id,
         date_trunc('month', case when trim("납기예정일") ~ '^\d{4}-\d{2}-\d{2}$' then trim("납기예정일")::date end)::date period,
         sum(nullif(trim("발주수량"),'')::numeric) scheduled_receipts
  from raw.purchase_order where nullif(trim("납기예정일"),'') is not null group by 1,2
), confirmed_orders as (
  select upper(regexp_replace(item_id, '[\s\-_]', '', 'g')) item_id, date_trunc('month', need_date)::date period, sum(order_qty) confirmed_sales_order
  from raw.sales_order s cross join config c
  where need_date is not null and status = any(array(select jsonb_array_elements_text(c.confirmed_sales_statuses))) group by 1,2
), soft as (
  select item_id, date_trunc('month', allocation_date)::date period, sum(qty) soft_allocation
  from core.soft_allocation where status='ACTIVE' group by 1,2
), components as (
  select f.item_id, i.item_name, i.supplier_id, f.period,
         row_number() over(partition by f.item_id order by f.period)::integer period_no,
         inv.available_inventory, f.forecast_demand, f.model_id, f.model_version,
         coalesce(rc.scheduled_receipts,0)::numeric scheduled_receipts,
         coalesce(so.confirmed_sales_order,0)::numeric confirmed_sales_order,
         coalesce(sa.soft_allocation,0)::numeric soft_allocation,
         case when exists(select 1 from core.soft_allocation x where x.item_id=f.item_id) then 'AVAILABLE' else 'NOT_CONFIGURED' end as soft_allocation_status,
         case when exists(select 1 from raw.sales_order x where upper(regexp_replace(x.item_id, '[\s\-_]', '', 'g'))=f.item_id) then 'AVAILABLE' else 'NOT_CONFIGURED' end as confirmed_sales_order_status,
         lt.effective_lead_time
  from forecasts f join items i using(item_id) left join inventory inv using(item_id) left join receipts rc using(item_id,period)
  left join confirmed_orders so using(item_id,period) left join soft sa using(item_id,period)
  left join lateral (select effective_lead_time from analytics.v_leadtime_policy lp where lp.item_id=f.item_id limit 1) lt on true
), projected(item_id,item_name,supplier_id,period,period_no,available_inventory,beginning_inventory,scheduled_receipts,confirmed_sales_order,soft_allocation,forecast_demand,ending_projected_inventory,stockout_period,days_of_supply,months_of_supply,risk_status,reason_code,model_id,model_version,effective_lead_time,soft_allocation_status,confirmed_sales_order_status) as (
  select c.item_id,c.item_name,c.supplier_id,c.period,c.period_no,c.available_inventory,c.available_inventory,c.scheduled_receipts,c.confirmed_sales_order,c.soft_allocation,c.forecast_demand,
         case when c.available_inventory is null or c.forecast_demand is null then null else c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand end,
         case when c.available_inventory is null then c.period when c.forecast_demand is null then c.period when c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then c.period end,
         case when c.available_inventory is null then null when c.forecast_demand is null then null when c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then greatest(0,(c.period-current_date)::numeric) end,
         case when c.available_inventory is null or c.forecast_demand is null then null when c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then greatest(0,round((c.period-current_date)::numeric/30,2)) end,
         case when c.available_inventory is null then 'CALCULATION_UNAVAILABLE' when c.forecast_demand is null then 'CALCULATION_UNAVAILABLE' when c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 and c.effective_lead_time is not null and c.period < current_date+c.effective_lead_time then 'CRITICAL' when c.available_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then 'WARNING' else 'SAFE' end,
         case when c.available_inventory is null then 'NO_INVENTORY_DATA' when c.effective_lead_time is null then 'NO_LEADTIME' when c.forecast_demand is null then 'NO_FORECAST' end,
         c.model_id,c.model_version,c.effective_lead_time,c.soft_allocation_status,c.confirmed_sales_order_status
  from components c where c.period_no=1
  union all
  select c.item_id,c.item_name,c.supplier_id,c.period,c.period_no,c.available_inventory,p.ending_projected_inventory,c.scheduled_receipts,c.confirmed_sales_order,c.soft_allocation,c.forecast_demand,
         case when p.ending_projected_inventory is null or c.forecast_demand is null then null else p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand end,
         case when p.ending_projected_inventory is null then c.period when c.forecast_demand is null then c.period when p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then c.period end,
         case when p.ending_projected_inventory is null or c.forecast_demand is null then null when p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then greatest(0,(c.period-current_date)::numeric) end,
         case when p.ending_projected_inventory is null or c.forecast_demand is null then null when p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then greatest(0,round((c.period-current_date)::numeric/30,2)) end,
         case when p.ending_projected_inventory is null then 'CALCULATION_UNAVAILABLE' when c.forecast_demand is null then 'CALCULATION_UNAVAILABLE' when p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 and c.effective_lead_time is not null and c.period < current_date+c.effective_lead_time then 'CRITICAL' when p.ending_projected_inventory+c.scheduled_receipts-c.confirmed_sales_order-c.soft_allocation-c.forecast_demand <= 0 then 'WARNING' else 'SAFE' end,
         case when p.ending_projected_inventory is null then 'NO_INVENTORY_DATA' when c.effective_lead_time is null then 'NO_LEADTIME' when c.forecast_demand is null then 'NO_FORECAST' end,
         c.model_id,c.model_version,c.effective_lead_time,c.soft_allocation_status,c.confirmed_sales_order_status
  from projected p join components c on c.item_id=p.item_id and c.period_no=p.period_no+1
)
select * from projected;

create or replace view analytics.v_stockout_risk as
with items as (select item_id,item_name,supplier_id from core.v_item_master where is_active='Y'),
summary as (
  select p.item_id, min(p.item_name) item_name, min(p.supplier_id) supplier_id, min(p.available_inventory) current_stock,
         sum(p.scheduled_receipts) inbound_qty, min(p.effective_lead_time) effective_lead_time,
         min(p.period) filter(where p.ending_projected_inventory <= 0) stockout_period,
         max(p.days_of_supply) days_of_supply, max(p.months_of_supply) months_of_supply,
         bool_or(p.forecast_demand is not null) has_forecast, min(p.reason_code) reason_code
  from analytics.v_inventory_projection p group by p.item_id
), base as (
  select i.*, s.current_stock, s.inbound_qty, s.effective_lead_time, s.stockout_period, s.days_of_supply, s.months_of_supply, s.has_forecast, s.reason_code
  from items i left join summary s using(item_id)
)
select item_id,item_name,supplier_id,current_stock,inbound_qty,current_stock available_qty,null::numeric daily_usage_avg,null::numeric cv,effective_lead_time planned_lead_time,
       days_of_supply stockout_days,stockout_period::date stockout_date,
       case when current_stock is null then 'CALCULATION_UNAVAILABLE' when effective_lead_time is null then 'CALCULATION_UNAVAILABLE' when not coalesce(has_forecast,false) then 'CALCULATION_UNAVAILABLE' when stockout_period is null then 'SAFE' when stockout_period < current_date + effective_lead_time then 'CRITICAL' else 'WARNING' end risk_status,
       case when current_stock is null then 'NO_INVENTORY_DATA' when effective_lead_time is null then 'NO_LEADTIME' when not coalesce(has_forecast,false) then 'NO_FORECAST' else reason_code end reason,
       stockout_period,months_of_supply,effective_lead_time,
       case when current_stock is null then 'NO_INVENTORY_DATA' when effective_lead_time is null then 'NO_LEADTIME' when not coalesce(has_forecast,false) then 'NO_FORECAST' else reason_code end reason_code
from base;

create or replace view analytics.v_stockout_kpi as
select count(*)::integer n_items, count(*) filter(where risk_status='CRITICAL')::integer n_critical,
       count(*) filter(where risk_status='SAFE')::integer n_safe, count(*) filter(where risk_status='CALCULATION_UNAVAILABLE')::integer n_unknown,
       count(*) filter(where stockout_days is not null and stockout_days <= 30)::integer n_within_30d,
       avg(stockout_days) filter(where stockout_days is not null) avg_stockout_days,
       count(*) filter(where risk_status='WARNING')::integer n_warning
from analytics.v_stockout_risk;

grant select on analytics.v_leadtime_policy, analytics.v_inventory_projection, analytics.v_stockout_risk, analytics.v_stockout_kpi to authenticated;

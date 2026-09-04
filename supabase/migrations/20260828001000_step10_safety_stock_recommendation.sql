create schema if not exists core;
create schema if not exists analytics;

-- 등급별 서비스 수준은 화면이나 TypeScript에 두지 않고 DB에서 관리합니다.
create table if not exists core.service_level_policy (
  item_grade text primary key,
  service_level numeric(5,4) not null check (service_level > 0 and service_level < 1),
  z_value numeric(8,5) not null check (z_value > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into core.service_level_policy(item_grade, service_level, z_value)
values ('A', 0.9900, 2.32635), ('B', 0.9750, 1.95996), ('C', 0.9500, 1.64485)
on conflict (item_grade) do nothing;

alter table core.service_level_policy enable row level security;
drop policy if exists service_level_policy_select on core.service_level_policy;
create policy service_level_policy_select on core.service_level_policy for select to authenticated using (true);
drop policy if exists service_level_policy_admin on core.service_level_policy;
create policy service_level_policy_admin on core.service_level_policy for all to authenticated using (core.is_admin()) with check (core.is_admin());
revoke all on core.service_level_policy from anon;
grant usage on schema core to authenticated;
grant select on core.service_level_policy to authenticated;
grant insert, update, delete on core.service_level_policy to authenticated;

-- sigma_DLT = sqrt(L * sigma_d^2 + d^2 * sigma_L^2)
-- sigma_d: 최신 Champion 모델의 test actual 오차 표준편차를 우선 사용하고,
-- 비교 가능한 오차가 없을 때 저장된 forecast_result.sigma를 사용합니다.
-- d: projection horizon의 forecast 평균, L: effective lead time,
-- sigma_L: core.v_leadtime_stat의 실적 표준편차입니다.
create or replace view analytics.v_safety_stock as
with items as (
  select item_id, item_name, supplier_id
  from core.v_item_master
  where is_active = 'Y'
), policy as (
  select item_id, moq, pack_size, item_grade, service_level
  from core.item_policy
), projections as (
  select item_id, avg(forecast_demand)::numeric as expected_demand
  from analytics.v_inventory_projection
  group by item_id
), leadtime as (
  select lp.item_id, lp.supplier_id, lp.effective_lead_time, st.std_days as sigma_l
  from analytics.v_leadtime_policy lp
  left join core.v_leadtime_stat st using (supplier_id)
), champion as (
  select distinct on (item_id) item_id, champion_model_id, model_version
  from core.champion_model
  order by item_id, selected_at desc
), error_stats as (
  select fr.item_id, fr.model_id, fr.model_version,
         stddev_samp(fr.predicted_qty - a.actual_qty)::numeric as sigma_d,
         count(*)::integer as error_periods
  from core.forecast_result fr
  join champion c on c.item_id = fr.item_id and c.champion_model_id = fr.model_id and c.model_version = fr.model_version
  join (
    select item_id, date_trunc('month', actual_date)::date as period,
           sum(qty) filter (where qty > 0)::numeric as actual_qty
    from core.v_test_actual
    group by item_id, date_trunc('month', actual_date)::date
  ) a using (item_id, period)
  group by fr.item_id, fr.model_id, fr.model_version
), stored_sigma as (
  select distinct on (fr.item_id) fr.item_id, fr.model_id, fr.model_version,
         fr.sigma::numeric as sigma_d
  from core.forecast_result fr
  join champion c on c.item_id = fr.item_id and c.champion_model_id = fr.model_id and c.model_version = fr.model_version
  where fr.sigma is not null
  order by fr.item_id, fr.period desc
), sources as (
  select i.item_id, i.item_name, i.supplier_id,
         p.item_grade, p.moq, p.pack_size, p.service_level as item_service_level,
         coalesce(p.item_grade, '') as grade_key,
         sl.service_level, sl.z_value,
         pr.expected_demand, lt.effective_lead_time, lt.sigma_l,
         coalesce(es.sigma_d, ss.sigma_d) as sigma_d,
         coalesce(es.error_periods, 0) as error_periods,
         c.model_id as forecast_model_id, c.model_version as forecast_model_version
  from items i
  left join policy p using (item_id)
  left join core.service_level_policy sl on sl.item_grade = p.item_grade
  left join projections pr using (item_id)
  left join leadtime lt using (item_id, supplier_id)
  left join error_stats es using (item_id)
  left join stored_sigma ss using (item_id)
  left join champion c using (item_id)
)
select item_id, item_name, supplier_id, item_grade, service_level, z_value,
       expected_demand, effective_lead_time, sigma_d, sigma_l,
       case when effective_lead_time is not null and sigma_d is not null and sigma_l is not null and expected_demand is not null
            then sqrt(effective_lead_time * power(sigma_d, 2) + power(expected_demand, 2) * power(sigma_l, 2)) end as sigma_dlt,
       case when effective_lead_time is not null and sigma_d is not null and sigma_l is not null and expected_demand is not null and z_value is not null
            then z_value * sqrt(effective_lead_time * power(sigma_d, 2) + power(expected_demand, 2) * power(sigma_l, 2)) end as safety_stock,
       error_periods, forecast_model_id, forecast_model_version,
       case when expected_demand is null then 'NO_FORECAST'
            when effective_lead_time is null then 'NO_LEADTIME'
            when error_periods = 0 and sigma_d is null then 'INSUFFICIENT_FORECAST_ERROR'
            when sigma_l is null then 'INSUFFICIENT_LEADTIME_VARIABILITY'
            when p.item_id is null then 'NO_ITEM_POLICY'
            when z_value is null then 'NO_SERVICE_LEVEL'
            else null end as reason_code
from sources s
left join policy p using (item_id);

-- 계산 근거는 calculation_trace로 보존합니다. required_qty <= 0인 정상 결과는
-- recommended_qty = 0이며 CALCULATION_UNAVAILABLE과 구분합니다.
create or replace view analytics.v_purchase_recommendation as
with config as (
  select coalesce(safety_buffer_days, 0)::numeric as safety_buffer_days
  from core.policy_config where policy_id = 'default'
), first_projection as (
  select distinct on (item_id) item_id, period, forecast_demand, confirmed_sales_order,
         scheduled_receipts, available_inventory, stockout_period, risk_status,
         model_id, model_version, fr.run_id as forecast_run_id
  from analytics.v_inventory_projection ip
  left join lateral (
    select run_id from core.forecast_result fr
    where fr.item_id = ip.item_id and fr.period = ip.period
      and fr.model_id = ip.model_id and fr.model_version = ip.model_version
    order by fr.run_id desc
    limit 1
  ) fr on true
  order by item_id, period
), base as (
  select ss.*, p.period, p.forecast_demand, p.confirmed_sales_order,
         p.scheduled_receipts, p.available_inventory, p.stockout_period,
         p.risk_status, p.model_id, p.model_version, p.forecast_run_id,
         coalesce(c.safety_buffer_days, 0)::numeric as safety_buffer_days,
         greatest(p.forecast_demand, coalesce(p.confirmed_sales_order, 0)) as demand_basis_qty
  from analytics.v_safety_stock ss
  left join first_projection p using (item_id)
  cross join config c
), calculated as (
  select b.*, (demand_basis_qty + safety_stock - available_inventory - scheduled_receipts)::numeric as required_qty,
         case when b.stockout_period is not null and b.effective_lead_time is not null
              then (b.stockout_period - b.effective_lead_time::integer - b.safety_buffer_days::integer)
              else null end::date as recommended_order_date
  from base b
), rounded as (
  select c.*, case when required_qty > 0 then greatest(required_qty, coalesce(moq, 0)) else required_qty end as moq_adjusted,
         case when required_qty > 0 and pack_size is not null and pack_size > 0
              then ceil(greatest(required_qty, coalesce(moq, 0)) / pack_size) * pack_size
              when required_qty > 0 then greatest(required_qty, coalesce(moq, 0))
              else required_qty end as rounded_recommended_qty
  from calculated c
)
select item_id,
       item_name,
       item_grade,
       forecast_demand as forecast_qty,
       confirmed_sales_order as confirmed_order_qty,
       demand_basis_qty,
       available_inventory,
       scheduled_receipts as scheduled_receipt,
       safety_stock,
       effective_lead_time as effective_leadtime,
       stockout_period::date as stockout_date,
       stockout_period,
       safety_buffer_days,
       required_qty,
       moq,
       pack_size,
       case when forecast_demand is null then null
            when available_inventory is null then null
            when safety_stock is null then null
            when reason_code is not null then null
            when required_qty <= 0 then 0
            else rounded_recommended_qty end as recommended_qty,
       recommended_order_date,
       (recommended_order_date is not null and recommended_order_date < current_date) as is_immediate,
       (recommended_order_date is not null and recommended_order_date < current_date) as is_overdue,
       risk_status,
       case when forecast_demand is null then 'CALCULATION_UNAVAILABLE'
            when available_inventory is null then 'CALCULATION_UNAVAILABLE'
            when reason_code is not null then 'CALCULATION_UNAVAILABLE'
            when required_qty <= 0 then 'NO_ORDER_REQUIRED'
            else 'CALCULATED' end as calculation_status,
       case when forecast_demand is null then 'NO_FORECAST'
            when available_inventory is null then 'NO_INVENTORY_DATA'
            else reason_code end as reason_code,
       forecast_run_id,
       model_version,
       jsonb_build_object(
         'forecast_qty', forecast_demand,
         'confirmed_order_qty', confirmed_sales_order,
         'demand_basis_qty', demand_basis_qty,
         'safety_stock', safety_stock,
         'available_inventory', available_inventory,
         'scheduled_receipt', scheduled_receipts,
         'required_qty', required_qty,
         'moq', moq,
         'pack_size', pack_size,
         'recommended_qty', case when forecast_demand is null or available_inventory is null or safety_stock is null or reason_code is not null then null when required_qty <= 0 then 0 else rounded_recommended_qty end,
         'effective_leadtime', effective_lead_time,
         'service_level', service_level,
         'z_value', z_value,
         'sigma_d', sigma_d,
         'sigma_l', sigma_l,
         'forecast_run_id', forecast_run_id,
         'model_version', model_version
       ) as calculation_trace
from rounded;

grant usage on schema analytics to authenticated;
grant select on analytics.v_safety_stock, analytics.v_purchase_recommendation to authenticated;

create schema if not exists analytics;

-- STEP 5는 raw를 조회하지 않고 학습 경계가 적용된 core.v_train_demand만 사용합니다.
-- 기간 Grid의 0은 해당 월에 양수 수요가 없다는 뜻이며 원본 NULL을 0으로 치환한 값이 아닙니다.
create or replace view analytics.v_sku_demand_profile as
with setting as (
  select date_trunc('month', train_start)::date as first_period,
         date_trunc('month', train_end)::date as last_period
  from core.forecast_setting
  where setting_id = 'default' and train_start is not null and train_end is not null
), periods as (
  select row_number() over (order by period_start)::integer as period_no,
         period_start::date as period_start
  from setting, generate_series(setting.first_period, setting.last_period, interval '1 month') as gs(period_start)
), items as (
  select item_id, max(item_name) as item_name
  from core.v_item_master
  group by item_id
), grid as (
  select i.item_id, i.item_name, p.period_no, p.period_start
  from items i cross join periods p
), monthly as (
  select g.item_id, g.item_name, g.period_no, g.period_start,
         coalesce(sum(v.qty) filter (where v.qty > 0), 0)::numeric as quantity,
         count(v.item_id) filter (where v.qty > 0)::integer as source_positive_rows
  from grid g
  left join core.v_train_demand v
    on v.item_id = g.item_id
   and date_trunc('month', v.demand_date)::date = g.period_start
  group by g.item_id, g.item_name, g.period_no, g.period_start
), aggregate as (
  select item_id, max(item_name) as item_name,
         count(*)::integer as n_periods,
         count(*) filter (where quantity > 0)::integer as n_nonzero_periods,
         avg(quantity) filter (where quantity > 0) as positive_mean,
         stddev_samp(quantity) filter (where quantity > 0) as positive_sd,
         regr_slope(quantity, period_no) as trend_per_period,
         max(quantity) as peak_quantity
  from monthly
  group by item_id
), ranked_peaks as (
  select item_id, period_start,
         row_number() over (partition by item_id order by quantity desc, period_start asc) as peak_rank
  from monthly
), recent as (
  select item_id,
         avg(quantity) filter (where period_no > max_period - 3) as recent_mean,
         avg(quantity) filter (where period_no > max_period - 6 and period_no <= max_period - 3) as previous_mean,
         count(*) filter (where period_no > max_period - 6) as recent_period_count
  from monthly
  cross join (select max(period_no) as max_period from periods) p
  group by item_id
), seasonal as (
  select item_id,
         stddev_samp(month_mean) / nullif(avg(month_mean), 0) as seasonal_cv
  from (
    select item_id, extract(month from period_start) as month_no, avg(quantity) as month_mean
    from monthly
    group by item_id, extract(month from period_start)
  ) by_month
  group by item_id
), calculated as (
  select a.*, p.period_start as peak_period,
         case when a.positive_mean is null or a.positive_mean = 0 then null else a.positive_sd / a.positive_mean end as cv,
         r.recent_mean, r.previous_mean, r.recent_period_count, s.seasonal_cv
  from aggregate a
  left join ranked_peaks p on p.item_id = a.item_id and p.peak_rank = 1
  left join recent r on r.item_id = a.item_id
  left join seasonal s on s.item_id = a.item_id
)
select item_id,
       item_name,
       n_periods,
       n_nonzero_periods,
       case when n_nonzero_periods = 0 then null else n_periods::numeric / n_nonzero_periods end as adi,
       cv,
       cv * cv as cv_squared,
       case when n_periods = 0 then null else (n_periods - n_nonzero_periods)::numeric / n_periods end as zero_demand_rate,
       trend_per_period as trend,
       case when recent_period_count < 6 or previous_mean is null or previous_mean = 0 then null else (recent_mean - previous_mean) / previous_mean end as recent_change_rate,
       to_char(peak_period, 'YYYY-MM') as peak_period,
       case when n_nonzero_periods = 0 or cv is null then null
            when n_periods::numeric / n_nonzero_periods < 1.32 and cv * cv < 0.49 then 'SMOOTH'
            when n_periods::numeric / n_nonzero_periods >= 1.32 and cv * cv < 0.49 then 'INTERMITTENT'
            when n_periods::numeric / n_nonzero_periods < 1.32 and cv * cv >= 0.49 then 'ERRATIC'
            else 'LUMPY' end as demand_type,
       case when n_periods < 24 then null
            when seasonal_cv >= 0.20 then 'SEASONAL'
            else 'NOT_SEASONAL' end as seasonality,
       case when n_nonzero_periods = 0 then 'NO_DEMAND'
            when cv is null then 'INSUFFICIENT_SAMPLES'
            when n_periods < 24 then 'INSUFFICIENT_PERIODS'
            when recent_period_count < 6 or previous_mean is null or previous_mean = 0 then 'INSUFFICIENT_RECENT_PERIODS'
            else null end as reason_code,
       case when n_nonzero_periods = 0 or cv is null then null
            when n_periods::numeric / n_nonzero_periods < 1.32 and cv * cv < 0.49 then 'STABLE'
            else 'VARIABLE' end as stability
from calculated;

comment on view analytics.v_sku_demand_profile is '학습기간 월 Grid 기반 SKU 수요 프로파일. peak 동률은 이른 월을 선택하며, seasonality는 24개월 이상에서 월별 평균 CV 0.20 이상을 SEASONAL로 판정한다.';

create or replace view analytics.v_demand_profile_kpi as
select count(*)::integer as total_items,
       count(*) filter (where demand_type = 'SMOOTH')::integer as n_smooth,
       count(*) filter (where demand_type = 'INTERMITTENT')::integer as n_intermittent,
       count(*) filter (where demand_type = 'ERRATIC')::integer as n_erratic,
       count(*) filter (where demand_type = 'LUMPY')::integer as n_lumpy,
       count(*) filter (where demand_type in ('INTERMITTENT','LUMPY'))::integer as n_croston_needed,
       count(*) filter (where demand_type is null)::integer as n_calculation_unavailable
from analytics.v_sku_demand_profile;

grant usage on schema analytics to authenticated;
grant select on analytics.v_sku_demand_profile, analytics.v_demand_profile_kpi to authenticated;

create schema if not exists raw;
create schema if not exists core;
create schema if not exists analytics;
create extension if not exists pgcrypto;

-- 기존 raw 입력 테이블은 삭제하지 않고 적재 추적 컬럼만 확장합니다.
do $$
declare table_name text;
begin
  foreach table_name in array array['shipment_log','usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','forecast'] loop
    if to_regclass(format('raw.%I', table_name)) is not null then
      execute format('alter table raw.%I add column if not exists batch_id uuid', table_name);
      execute format('alter table raw.%I add column if not exists source_type text', table_name);
      execute format('alter table raw.%I add column if not exists loaded_at timestamptz default now()', table_name);
      execute format('alter table raw.%I add column if not exists source_record_id text', table_name);
    end if;
  end loop;
end $$;

create table if not exists raw.business_event (
  event_id text primary key,
  item_id text,
  event_type text not null,
  event_date date not null,
  qty numeric,
  note text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);

create table if not exists raw.sales_order (
  sales_order_id text primary key,
  order_date date not null,
  customer_id text,
  item_id text not null,
  order_qty numeric,
  need_date date,
  status text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);

create table if not exists raw.item_substitute (
  item_id text not null,
  substitute_item_id text not null,
  priority integer,
  is_active boolean not null default true,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text,
  primary key (item_id, substitute_item_id)
);

create table if not exists core.policy_config (
  policy_id text primary key default 'default',
  service_level numeric(5,4) not null default 0.9500 check (service_level > 0 and service_level <= 1),
  review_period_days integer not null default 30 check (review_period_days > 0),
  safety_buffer_days integer not null default 0 check (safety_buffer_days >= 0),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists core.outlier_rule (
  rule_id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  description text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists core.item_policy (
  item_id text primary key,
  moq numeric,
  pack_size numeric,
  item_grade text,
  service_level numeric(5,4) check (service_level is null or (service_level > 0 and service_level <= 1)),
  updated_at timestamptz not null default now()
);

create table if not exists core.forecast_setting (
  setting_id text primary key default 'default',
  train_start date,
  train_end date,
  test_start date,
  test_end date,
  granularity text not null default 'month' check (granularity in ('day', 'week', 'month')),
  updated_at timestamptz not null default now(),
  check (train_start is null or train_end is null or train_start <= train_end),
  check (test_start is null or test_end is null or test_start <= test_end),
  check (train_end is null or test_start is null or train_end < test_start)
);

insert into core.policy_config(policy_id) values ('default') on conflict (policy_id) do nothing;
insert into core.forecast_setting(setting_id) values ('default') on conflict (setting_id) do nothing;
insert into core.outlier_rule(rule_code, description, priority) values
  ('RETURN', '음수 수량 반품을 학습에서 제외', 10),
  ('PROJECT', '프로젝트성 수요를 학습에서 제외', 20),
  ('DUPLICATE', '동일 source record 중복을 학습에서 제외', 30)
on conflict (rule_code) do nothing;

create or replace view core.v_train_demand as
with setting as (select * from core.forecast_setting where setting_id = 'default'),
deduplicated as (
  select u.*, row_number() over (partition by coalesce(u.source_record_id, u.usage_id) order by u.loaded_at nulls last, u.usage_id) as duplicate_rank
  from raw.usage_history u
)
select upper(regexp_replace(d.item_id, '[\s\-_]', '', 'g')) as item_id,
       d.use_date as demand_date,
       d.qty,
       d.warehouse,
       d.usage_id as source_record_id,
       d.batch_id,
       d.source_type
from deduplicated d cross join setting s
where d.use_date between s.train_start and s.train_end
  and d.use_date is not null
  and not (exists (select 1 from core.outlier_rule r where r.rule_code = 'RETURN' and r.enabled and d.qty < 0))
  and not (exists (select 1 from core.outlier_rule r where r.rule_code = 'PROJECT' and r.enabled and coalesce(d.note, '') ilike '%프로젝트%'))
  and not (exists (select 1 from core.outlier_rule r where r.rule_code = 'DUPLICATE' and r.enabled and d.duplicate_rank > 1));

create or replace view core.v_test_actual as
select upper(regexp_replace(u.item_id, '[\s\-_]', '', 'g')) as item_id,
       u.use_date as actual_date,
       u.qty,
       u.warehouse,
       u.usage_id as source_record_id,
       u.batch_id,
       u.source_type
from raw.usage_history u cross join core.forecast_setting s
where s.setting_id = 'default'
  and u.use_date between s.test_start and s.test_end
  and u.use_date is not null;

create or replace view analytics.v_data_coverage as
with bounds as (select min(use_date) as data_start, max(use_date) as data_end from raw.usage_history),
train as (select count(*) as row_count from core.v_train_demand),
test as (select count(*) as row_count from core.v_test_actual)
select b.data_start,
       b.data_end,
       s.train_start,
       s.train_end,
       s.test_start,
       s.test_end,
       tr.row_count as train_row_count,
       te.row_count as test_row_count,
       (s.train_start is not null and s.train_end is not null and b.data_start <= s.train_start and b.data_end >= s.train_end) as train_window_ok,
       (s.test_start is not null and s.test_end is not null and b.data_start <= s.test_start and b.data_end >= s.test_end) as test_window_ok,
       (s.train_end is not null and s.test_start is not null and s.train_end < s.test_start) as windows_disjoint,
       s.granularity
from bounds b cross join core.forecast_setting s cross join train tr cross join test te
where s.setting_id = 'default';

create or replace view analytics.v_forecast_settings as
select c.data_start, c.data_end, c.train_start, c.train_end, c.test_start, c.test_end,
       c.train_row_count, c.test_row_count, c.train_window_ok, c.test_window_ok, c.windows_disjoint, c.granularity,
       p.service_level, p.review_period_days, p.safety_buffer_days, p.settings as policy_settings
from analytics.v_data_coverage c
cross join core.policy_config p
where p.policy_id = 'default';

revoke all on schema raw from anon, authenticated;
revoke all on all tables in schema raw from anon, authenticated;
grant usage on schema analytics to authenticated;
grant select on analytics.v_data_coverage, analytics.v_forecast_settings to authenticated;
grant usage on schema core to authenticated;
grant select, insert, update, delete on core.policy_config, core.outlier_rule, core.item_policy, core.forecast_setting to authenticated;

alter table core.policy_config enable row level security;
alter table core.outlier_rule enable row level security;
alter table core.item_policy enable row level security;
alter table core.forecast_setting enable row level security;

drop policy if exists policy_config_select_authenticated on core.policy_config;
create policy policy_config_select_authenticated on core.policy_config for select to authenticated using (true);
drop policy if exists outlier_rule_select_authenticated on core.outlier_rule;
create policy outlier_rule_select_authenticated on core.outlier_rule for select to authenticated using (true);
drop policy if exists item_policy_select_authenticated on core.item_policy;
create policy item_policy_select_authenticated on core.item_policy for select to authenticated using (true);
drop policy if exists forecast_setting_select_authenticated on core.forecast_setting;
create policy forecast_setting_select_authenticated on core.forecast_setting for select to authenticated using (true);

drop policy if exists policy_config_admin_mutation on core.policy_config;
create policy policy_config_admin_mutation on core.policy_config for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists outlier_rule_admin_mutation on core.outlier_rule;
create policy outlier_rule_admin_mutation on core.outlier_rule for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists item_policy_admin_mutation on core.item_policy;
create policy item_policy_admin_mutation on core.item_policy for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists forecast_setting_admin_mutation on core.forecast_setting;
create policy forecast_setting_admin_mutation on core.forecast_setting for all to authenticated using (core.is_admin()) with check (core.is_admin());

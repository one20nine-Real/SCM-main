-- STEP 2 RLS 정책입니다. 기존 수업용 전체 허용 정책을 제거합니다.
drop policy if exists "수업용 전체 허용" on core.leadtime_plan;
drop policy if exists "수업용 전체 허용" on core.usage_profile;

revoke insert, update, delete on core.leadtime_plan, core.usage_profile from anon, authenticated;
grant select, insert, update, delete on core.leadtime_plan, core.usage_profile to authenticated;

drop policy if exists leadtime_plan_select_authenticated on core.leadtime_plan;
drop policy if exists usage_profile_select_authenticated on core.usage_profile;
drop policy if exists leadtime_plan_admin_mutation on core.leadtime_plan;
drop policy if exists usage_profile_admin_mutation on core.usage_profile;

create policy leadtime_plan_select_authenticated
  on core.leadtime_plan for select to authenticated using (true);
create policy usage_profile_select_authenticated
  on core.usage_profile for select to authenticated using (true);
create policy leadtime_plan_admin_mutation
  on core.leadtime_plan for all to authenticated using (core.is_admin()) with check (core.is_admin());
create policy usage_profile_admin_mutation
  on core.usage_profile for all to authenticated using (core.is_admin()) with check (core.is_admin());

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

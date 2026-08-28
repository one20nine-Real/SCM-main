-- STEP 2 기준 권한입니다. anon은 업무 스키마에 접근하지 못합니다.
revoke all on schema core from anon;
revoke all on schema analytics from anon;
revoke all on all tables in schema core from anon;
revoke all on all tables in schema analytics from anon;

grant usage on schema core, analytics to authenticated;
grant select on all tables in schema analytics to authenticated;
grant select on all tables in schema core to authenticated;

alter default privileges in schema analytics grant select on tables to authenticated;
alter default privileges in schema core grant select on tables to authenticated;

-- 사용자·감사 로그와 관리자 RPC의 세부 권한은
-- supabase/migrations/20260828000200_step2_auth_rbac.sql에서 설정합니다.

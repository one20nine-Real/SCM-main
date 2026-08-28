create schema if not exists core;

create table if not exists core.app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  department text not null default '',
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists core.audit_log (
  id bigint generated always as identity primary key,
  actor uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index if not exists app_user_role_active_idx on core.app_user(role, active);
create index if not exists audit_log_target_idx on core.audit_log(target_type, target_id, at desc);

create or replace function core.set_app_user_updated_at() returns trigger language plpgsql security invoker set search_path = core, public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists app_user_set_updated_at on core.app_user;
create trigger app_user_set_updated_at before update on core.app_user for each row execute function core.set_app_user_updated_at();

create or replace function core.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = core, public as $$
begin
  insert into core.app_user(user_id, email, name, department) values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''), coalesce(new.raw_user_meta_data->>'department', ''))
  on conflict (user_id) do update set email = excluded.email, updated_at = now();
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function core.handle_new_auth_user();

insert into core.app_user(user_id, email, name, department)
select id, coalesce(email, ''), coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', ''), coalesce(raw_user_meta_data->>'department', '') from auth.users
on conflict (user_id) do nothing;

create or replace function core.is_admin() returns boolean language sql stable security definer set search_path = core, public as $$ select exists(select 1 from core.app_user where user_id = auth.uid() and role = 'ADMIN' and active = true); $$;

create or replace function core.touch_last_login() returns void language sql security definer set search_path = core, public as $$ update core.app_user set last_login_at = now() where user_id = auth.uid() and active = true; $$;

create or replace function core.admin_update_user(target_user_id uuid, next_role text, next_active boolean) returns core.app_user language plpgsql security definer set search_path = core, public as $$
declare old_row core.app_user; new_row core.app_user;
begin
  if not core.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into old_row from core.app_user where user_id = target_user_id for update;
  if old_row.user_id is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if old_row.user_id = auth.uid() and (next_role <> old_row.role or next_active <> old_row.active) then raise exception 'SELF_ACCOUNT_CHANGE_FORBIDDEN' using errcode = '42501'; end if;
  if next_role not in ('ADMIN', 'USER') then raise exception 'INVALID_ROLE' using errcode = '22023'; end if;
  update core.app_user set role = next_role, active = next_active where user_id = target_user_id returning * into new_row;
  insert into core.audit_log(actor, action, target_type, target_id, before, after) values (auth.uid(), case when old_row.role <> new_row.role then 'USER_ROLE_CHANGED' else 'USER_ACTIVE_CHANGED' end, 'app_user', target_user_id::text, to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end; $$;

revoke all on schema core from anon;
revoke all on core.app_user from anon, authenticated;
revoke all on core.audit_log from anon, authenticated;
grant usage on schema core to authenticated;
grant select on core.app_user, core.audit_log to authenticated;
grant execute on function core.is_admin() to anon, authenticated;
grant execute on function core.touch_last_login() to authenticated;
grant execute on function core.admin_update_user(uuid, text, boolean) to authenticated;
alter table core.app_user enable row level security;
alter table core.audit_log enable row level security;
drop policy if exists app_user_select_self_or_admin on core.app_user;
create policy app_user_select_self_or_admin on core.app_user for select to authenticated using (user_id = auth.uid() or core.is_admin());
drop policy if exists audit_log_select_admin on core.audit_log;
create policy audit_log_select_admin on core.audit_log for select to authenticated using (core.is_admin());

revoke insert, update, delete on core.leadtime_plan, core.usage_profile from anon, authenticated;
grant select, insert, update, delete on core.leadtime_plan, core.usage_profile to authenticated;
drop policy if exists "수업용 전체 허용" on core.leadtime_plan;
drop policy if exists "수업용 전체 허용" on core.usage_profile;
create policy leadtime_plan_select_authenticated on core.leadtime_plan for select to authenticated using (true);
create policy usage_profile_select_authenticated on core.usage_profile for select to authenticated using (true);
create policy leadtime_plan_admin_mutation on core.leadtime_plan for all to authenticated using (core.is_admin()) with check (core.is_admin());
create policy usage_profile_admin_mutation on core.usage_profile for all to authenticated using (core.is_admin()) with check (core.is_admin());

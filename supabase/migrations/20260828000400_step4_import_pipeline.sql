create schema if not exists core;
create extension if not exists pgcrypto;

create table if not exists core.upload_batch (
  batch_id uuid primary key default gen_random_uuid(),
  file_name text not null,
  import_type text not null check (import_type in ('usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','sales_order','business_event','item_substitute')),
  import_mode text not null check (import_mode in ('append','upsert','replace')),
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  status text not null default 'PARSED' check (status in ('PARSED','VALIDATED','READY','IMPORTED','ROLLED_BACK','FAILED','ROLLBACK_UNAVAILABLE')),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  imported_at timestamptz,
  rolled_back_at timestamptz,
  forecast_stale boolean not null default false,
  stale_reason text
);

create table if not exists core.import_staging (
  staging_id bigint generated always as identity primary key,
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  mapped_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING','SUCCESS','WARNING','ERROR')),
  created_at timestamptz not null default now(),
  unique(batch_id, row_number)
);

create table if not exists core.column_mapping (
  mapping_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  import_type text not null,
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, import_type)
);

create table if not exists core.validation_error (
  error_id bigint generated always as identity primary key,
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  row_number integer not null,
  field_name text not null default '',
  error_code text not null,
  error_message text not null,
  severity text not null check (severity in ('ERROR','WARNING')),
  original_value jsonb,
  created_at timestamptz not null default now()
);

alter table core.upload_batch add column if not exists forecast_stale boolean not null default false;
alter table core.upload_batch add column if not exists stale_reason text;

alter table core.upload_batch enable row level security;
alter table core.import_staging enable row level security;
alter table core.column_mapping enable row level security;
alter table core.validation_error enable row level security;

drop policy if exists upload_batch_admin_select on core.upload_batch;
create policy upload_batch_admin_select on core.upload_batch for select to authenticated using (core.is_admin());
drop policy if exists staging_admin_select on core.import_staging;
create policy staging_admin_select on core.import_staging for select to authenticated using (core.is_admin());
drop policy if exists mapping_owner_select on core.column_mapping;
create policy mapping_owner_select on core.column_mapping for select to authenticated using (owner_id = auth.uid() or core.is_admin());
drop policy if exists validation_admin_select on core.validation_error;
create policy validation_admin_select on core.validation_error for select to authenticated using (core.is_admin());

grant usage on schema core to authenticated;
grant select on core.upload_batch, core.import_staging, core.column_mapping, core.validation_error to authenticated;
grant usage, select on sequence core.import_staging_staging_id_seq, core.validation_error_error_id_seq to authenticated;

create or replace function core.create_upload_batch(p_file_name text, p_import_type text, p_import_mode text, p_total_rows integer)
returns uuid language plpgsql security definer set search_path = core, public
as $$
declare v_id uuid;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into core.upload_batch(file_name, import_type, import_mode, total_rows, uploaded_by)
  values (p_file_name, p_import_type, p_import_mode, p_total_rows, auth.uid()) returning batch_id into v_id;
  return v_id;
end;
$$;

create or replace function core.stage_import_rows(p_batch_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = core, public
as $$
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from core.upload_batch where batch_id = p_batch_id and status = 'PARSED') then raise exception 'BATCH_NOT_PARSED'; end if;
  insert into core.import_staging(batch_id, row_number, raw_data)
  select p_batch_id, (row->>'row_number')::integer, coalesce(row->'raw_data','{}'::jsonb)
  from jsonb_array_elements(p_rows) row;
end;
$$;

create or replace function core.record_validation(p_batch_id uuid, p_rows jsonb, p_success integer, p_warning integer, p_error integer)
returns void language plpgsql security definer set search_path = core, public
as $$
declare row jsonb; issue jsonb; v_status text;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  delete from core.validation_error where batch_id = p_batch_id;
  for row in select * from jsonb_array_elements(p_rows) loop
    v_status := row->>'status';
    update core.import_staging set mapped_data = coalesce(row->'mapped','{}'::jsonb), validation_status = v_status where batch_id = p_batch_id and row_number = (row->>'row_number')::integer;
    for issue in select * from jsonb_array_elements(coalesce(row->'issues','[]'::jsonb)) loop
      insert into core.validation_error(batch_id,row_number,field_name,error_code,error_message,severity,original_value)
      values (p_batch_id,(row->>'row_number')::integer,coalesce(issue->>'fieldName',''),issue->>'errorCode',issue->>'errorMessage',issue->>'severity',issue->'originalValue');
    end loop;
  end loop;
  update core.upload_batch set success_rows=p_success, warning_rows=p_warning, error_rows=p_error, status=case when p_error > 0 then 'VALIDATED' else 'READY' end where batch_id=p_batch_id;
end;
$$;

create or replace function core.import_batch(p_batch_id uuid, p_confirm_replace boolean default false)
returns core.upload_batch language plpgsql security definer set search_path = core, public
as $$
declare b core.upload_batch; r record; v_source text;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into b from core.upload_batch where batch_id=p_batch_id for update;
  if b.batch_id is null or b.status <> 'READY' then raise exception 'BATCH_NOT_READY'; end if;
  if b.import_mode='replace' and not p_confirm_replace then raise exception 'REPLACE_CONFIRMATION_REQUIRED'; end if;
  if b.import_mode='replace' then execute format('delete from raw.%I', b.import_type);
  elsif b.import_mode='upsert' then execute format('delete from raw.%I where source_record_id in (select mapped_data->>''_source_record_id'' from core.import_staging where batch_id=$1)', b.import_type) using p_batch_id;
  end if;
  if b.import_type='usage_history' then
    insert into raw.usage_history(usage_id,item_id,use_date,qty,warehouse,note,batch_id,source_type,loaded_at,source_record_id) select x.usage_id,x.item_id,x.use_date,x.qty,x.warehouse,x.note,p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.usage_history,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='inventory' then
    insert into raw.inventory("품목코드","창고","현재고","기준일자","안전재고",batch_id,source_type,loaded_at,source_record_id) select x."품목코드",x."창고",x."현재고",x."기준일자",x."안전재고",p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.inventory,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='item_master' then
    insert into raw.item_master("품목코드","품목명","품목구분","단위","표준단가","사용여부",supplier_id,batch_id,source_type,loaded_at,source_record_id) select x."품목코드",x."품목명",x."품목구분",x."단위",x."표준단가",x."사용여부",x.supplier_id,p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.item_master,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='supplier_master' then
    insert into raw.supplier_master("공급업체코드","공급업체명","국가","표준리드타임(일)","담당자","사용여부",batch_id,source_type,loaded_at,source_record_id) select x."공급업체코드",x."공급업체명",x."국가",x."표준리드타임(일)",x."담당자",x."사용여부",p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.supplier_master,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='purchase_order' then
    insert into raw.purchase_order("발주번호","발주일","공급업체","품목코드","발주수량","단가","납기예정일","발주담당",batch_id,source_type,loaded_at,source_record_id) select x."발주번호",x."발주일",x."공급업체",x."품목코드",x."발주수량",x."단가",x."납기예정일",x."발주담당",p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.purchase_order,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='goods_receipt' then
    insert into raw.goods_receipt("입고번호","발주번호","품목코드","입고수량","입고일","입고창고",batch_id,source_type,loaded_at,source_record_id) select x."입고번호",x."발주번호",x."품목코드",x."입고수량",x."입고일",x."입고창고",p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.goods_receipt,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='sales_order' then
    insert into raw.sales_order(sales_order_id,order_date,customer_id,item_id,order_qty,need_date,status,batch_id,source_type,loaded_at,source_record_id) select x.sales_order_id,x.order_date,x.customer_id,x.item_id,x.order_qty,x.need_date,x.status,p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.sales_order,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='business_event' then
    insert into raw.business_event(event_id,item_id,event_type,event_date,qty,note,batch_id,source_type,loaded_at,source_record_id) select x.event_id,x.item_id,x.event_type,x.event_date,x.qty,x.note,p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.business_event,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  elsif b.import_type='item_substitute' then
    insert into raw.item_substitute(item_id,substitute_item_id,priority,is_active,batch_id,source_type,loaded_at,source_record_id) select x.item_id,x.substitute_item_id,x.priority,x.is_active,p_batch_id,'FILE_UPLOAD',now(),s.mapped_data->>'_source_record_id' from core.import_staging s cross join lateral jsonb_populate_record(null::raw.item_substitute,s.mapped_data) x where s.batch_id=p_batch_id and s.validation_status in ('SUCCESS','WARNING');
  end if;
  update core.upload_batch set status='IMPORTED', imported_at=now(), forecast_stale=(b.import_type in ('usage_history','sales_order','business_event')), stale_reason=case when b.import_type in ('usage_history','sales_order','business_event') then '수요 관련 파일 적재 후 Forecast 재계산 필요' else null end where batch_id=p_batch_id returning * into b;
  return b;
end;
$$;

create or replace function core.rollback_batch(p_batch_id uuid)
returns core.upload_batch language plpgsql security definer set search_path = core, public
as $$
declare b core.upload_batch;
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into b from core.upload_batch where batch_id=p_batch_id for update;
  if b.batch_id is null or b.status <> 'IMPORTED' then raise exception 'BATCH_NOT_IMPORTED'; end if;
  if b.import_mode='replace' then update core.upload_batch set status='ROLLBACK_UNAVAILABLE' where batch_id=p_batch_id returning * into b; return b; end if;
  execute format('delete from raw.%I where batch_id=$1', b.import_type) using p_batch_id;
  update core.upload_batch set status='ROLLED_BACK', rolled_back_at=now() where batch_id=p_batch_id returning * into b;
  return b;
end;
$$;

create or replace function core.save_column_mapping(p_import_type text, p_mapping jsonb)
returns void language plpgsql security definer set search_path = core, public
as $$
begin
  if not core.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into core.column_mapping(owner_id,import_type,mapping) values(auth.uid(),p_import_type,p_mapping)
  on conflict(owner_id,import_type) do update set mapping=excluded.mapping, updated_at=now();
end;
$$;

grant execute on function core.create_upload_batch(text,text,text,integer), core.stage_import_rows(uuid,jsonb), core.record_validation(uuid,jsonb,integer,integer,integer), core.import_batch(uuid,boolean), core.rollback_batch(uuid), core.save_column_mapping(text,jsonb) to authenticated;


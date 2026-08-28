import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportType, ParsedRow, ValidatedRow } from './types';

export async function createBatch(supabase: SupabaseClient, input: { fileName: string; importType: ImportType; importMode: string; totalRows: number }) {
  const { data, error } = await supabase.schema('core').rpc('create_upload_batch', { p_file_name: input.fileName, p_import_type: input.importType, p_import_mode: input.importMode, p_total_rows: input.totalRows });
  if (error) throw error; return data as string;
}
export async function stageRows(supabase: SupabaseClient, batchId: string, rows: ParsedRow[]) {
  const { error } = await supabase.schema('core').rpc('stage_import_rows', { p_batch_id: batchId, p_rows: rows.map((raw_data, index) => ({ row_number: index + 2, raw_data })) });
  if (error) throw error;
}
export async function saveMapping(supabase: SupabaseClient, importType: ImportType, mapping: Record<string, string>) {
  const { error } = await supabase.schema('core').rpc('save_column_mapping', { p_import_type: importType, p_mapping: mapping });
  if (error) throw error;
}
export async function readStaging(supabase: SupabaseClient, batchId: string) {
  const { data, error } = await supabase.schema('core').from('import_staging').select('row_number,raw_data').eq('batch_id', batchId).order('row_number');
  if (error) throw error; return (data ?? []) as { row_number: number; raw_data: ParsedRow }[];
}
export async function recordValidation(supabase: SupabaseClient, batchId: string, rows: ValidatedRow[]) {
  const { error } = await supabase.schema('core').rpc('record_validation', { p_batch_id: batchId, p_rows: rows, p_success: rows.filter((row) => row.status === 'SUCCESS').length, p_warning: rows.filter((row) => row.status === 'WARNING').length, p_error: rows.filter((row) => row.status === 'ERROR').length });
  if (error) throw error;
}
export async function importBatch(supabase: SupabaseClient, batchId: string, confirmReplace: boolean) {
  const { data, error } = await supabase.schema('core').rpc('import_batch', { p_batch_id: batchId, p_confirm_replace: confirmReplace });
  if (error) throw error; return data;
}
export async function rollbackBatch(supabase: SupabaseClient, batchId: string) {
  const { data, error } = await supabase.schema('core').rpc('rollback_batch', { p_batch_id: batchId });
  if (error) throw error; return data;
}
export async function getReferenceSets(supabase: SupabaseClient) {
  const [{ data: items, error: itemError }, { data: suppliers, error: supplierError }] = await Promise.all([
    supabase.schema('core').from('v_item_master').select('item_id'),
    supabase.schema('core').from('supplier_alias').select('alias,supplier_id'),
  ]);
  if (itemError) throw itemError; if (supplierError) throw supplierError;
  return { itemIds: new Set((items ?? []).map((row) => row.item_id)), supplierIds: new Set((suppliers ?? []).flatMap((row) => [row.supplier_id, row.alias].filter(Boolean))) };
}


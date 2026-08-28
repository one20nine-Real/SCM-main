import type { SupabaseClient } from '@supabase/supabase-js';
export async function getImportHistory(supabase: SupabaseClient) { const { data, error } = await supabase.schema('core').from('upload_batch').select('*').order('uploaded_at', { ascending: false }); if (error) throw error; return data ?? []; }
export async function getValidationErrors(supabase: SupabaseClient, batchId: string) { const { data, error } = await supabase.schema('core').from('validation_error').select('*').eq('batch_id', batchId).order('row_number'); if (error) throw error; return data ?? []; }


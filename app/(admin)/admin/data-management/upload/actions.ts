'use server';

import { requireAdmin } from '@/lib/auth';
import { getImportSchema, guessMapping } from '@/lib/import/schema';
import { parseImportFile } from '@/lib/import/parse';
import { getReferenceSets, readStaging, recordValidation, saveMapping, stageRows, createBatch, importBatch, rollbackBatch } from '@/lib/import/repository';
import { validateRows } from '@/lib/import/validate';
import type { ImportMode, ImportType } from '@/lib/import/types';

export type ImportActionState = { ok: boolean; message?: string; batchId?: string; importType?: ImportType; headers?: string[]; preview?: Record<string, unknown>[]; mapping?: Record<string, string>; totalRows?: number; counts?: { success: number; warning: number; error: number }; status?: string };
const fail = (error: unknown): ImportActionState => ({ ok: false, message: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.' });

export async function parseUpload(_previous: ImportActionState, formData: FormData): Promise<ImportActionState> {
  try {
    const { supabase } = await requireAdmin(); const file = formData.get('file'); const importType = formData.get('importType') as ImportType; const importMode = formData.get('importMode') as ImportMode;
    if (!(file instanceof File) || !file.size) return { ok: false, message: '파일을 선택하세요.' };
    const schema = getImportSchema(importType); if (!schema) return { ok: false, message: '지원하지 않는 Import Type입니다.' };
    const parsed = await parseImportFile(file.name, await file.arrayBuffer()); const batchId = await createBatch(supabase, { fileName: file.name, importType, importMode, totalRows: parsed.rows.length });
    await stageRows(supabase, batchId, parsed.rows); const mapping = guessMapping(parsed.headers, schema); await saveMapping(supabase, importType, mapping);
    return { ok: true, batchId, importType, headers: parsed.headers, preview: parsed.rows.slice(0, 20), mapping, totalRows: parsed.rows.length, message: 'Preview와 매핑을 확인한 뒤 Validation을 실행하세요.' };
  } catch (error) { return fail(error); }
}

export async function validateUpload(_previous: ImportActionState, formData: FormData): Promise<ImportActionState> {
  try {
    const { supabase } = await requireAdmin(); const batchId = String(formData.get('batchId')); const importType = String(formData.get('importType')) as ImportType; const mapping = JSON.parse(String(formData.get('mapping') || '{}')) as Record<string, string>;
    const staging = await readStaging(supabase, batchId); const references = await getReferenceSets(supabase); const context = { ...references, mapping: importType === 'item_master' || importType === 'supplier_master' ? undefined : mapping };
    const rows = validateRows(importType, staging.map((row) => row.raw_data), context); rows.forEach((row, index) => { row.mapped._source_record_id = `${batchId}:${row.rowNumber}`; if (row.status === 'ERROR') delete row.mapped._source_record_id; });
    await recordValidation(supabase, batchId, rows); return { ok: true, batchId, importType, counts: { success: rows.filter((row) => row.status === 'SUCCESS').length, warning: rows.filter((row) => row.status === 'WARNING').length, error: rows.filter((row) => row.status === 'ERROR').length }, status: rows.some((row) => row.status === 'ERROR') ? 'VALIDATED' : 'READY', message: rows.some((row) => row.status === 'ERROR') ? 'ERROR 행을 수정한 뒤 새 파일로 다시 업로드하세요.' : 'Validation이 완료되었습니다. 승인 후 Import할 수 있습니다.' };
  } catch (error) { return fail(error); }
}

export async function approveImport(_previous: ImportActionState, formData: FormData): Promise<ImportActionState> { try { const { supabase } = await requireAdmin(); const batchId = String(formData.get('batchId')); const result = await importBatch(supabase, batchId, formData.get('confirmReplace') === 'true'); return { ok: true, batchId, status: (result as { status: string }).status, message: '승인된 행을 RAW에 적재했습니다.' }; } catch (error) { return fail(error); } }
export async function rollbackImport(_previous: ImportActionState, formData: FormData): Promise<ImportActionState> { try { const { supabase } = await requireAdmin(); const batchId = String(formData.get('batchId')); const result = await rollbackBatch(supabase, batchId); return { ok: true, batchId, status: (result as { status: string }).status, message: 'batch 단위 rollback 결과를 반영했습니다.' }; } catch (error) { return fail(error); } }

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedFile, ParsedRow } from './types';

export async function parseImportFile(fileName: string, buffer: ArrayBuffer): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsed = Papa.parse<ParsedRow>(text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
    if (parsed.errors.length) throw new Error(`CSV_PARSE_ERROR: ${parsed.errors[0].message}`);
    const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
    return { headers: parsed.meta.fields ?? [], rows };
  }
  if (lower.endsWith('.xlsx')) {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error('XLSX_SHEET_NOT_FOUND: 첫 번째 시트를 찾을 수 없습니다.');
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: null, raw: false });
    return { headers: rows.length ? Object.keys(rows[0]) : [], rows };
  }
  throw new Error('UNSUPPORTED_FILE_TYPE: CSV 또는 XLSX 파일만 지원합니다.');
}


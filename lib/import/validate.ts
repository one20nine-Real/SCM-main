import { getImportSchema } from './schema.ts';
import type { ImportType, ParsedRow, ValidatedRow, ValidationIssue } from './types';

const isBlank = (value: unknown) => value === null || value === undefined || String(value).trim() === '';
function numberValue(value: unknown) { if (isBlank(value)) return null; const text = String(value).trim().replace(/,/g, ''); return /^[-+]?\d+(\.\d+)?$/.test(text) ? Number(text) : null; }
function dateValue(value: unknown) { if (isBlank(value)) return null; const text = String(value).trim().replace(/[./]/g, '-'); const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text); if (!match) return null; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const candidate = new Date(Date.UTC(year, month - 1, day)); return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null; }
function boolValue(value: unknown) { if (isBlank(value)) return null; const text = String(value).trim().toLowerCase(); if (['true', 't', '1', 'y', 'yes', '예', '사용'].includes(text)) return true; if (['false', 'f', '0', 'n', 'no', '아니오', '미사용'].includes(text)) return false; return null; }

export type ValidationContext = { itemIds?: Set<string>; supplierIds?: Set<string>; mapping?: Record<string, string> };
export function validateRows(type: ImportType, rows: ParsedRow[], context: ValidationContext = {}): ValidatedRow[] {
  const schema = getImportSchema(type); const seen = new Set<string>();
  return rows.map((original, index) => {
    const mapped: ParsedRow = {}; const issues: ValidationIssue[] = [];
    for (const spec of schema.fields) {
      const source = context.mapping?.[spec.key] ?? spec.aliases.find((alias) => Object.keys(original).some((header) => header.trim().toLowerCase() === alias.trim().toLowerCase()));
      const originalValue = source ? original[source] : null;
      if (spec.required && isBlank(originalValue)) issues.push({ fieldName: spec.target, errorCode: 'REQUIRED_FIELD', errorMessage: `${spec.label} 필수값이 없습니다.`, severity: 'ERROR', originalValue });
      if (isBlank(originalValue)) continue;
      if (spec.type === 'number') { const parsed = numberValue(originalValue); if (parsed === null) issues.push({ fieldName: spec.target, errorCode: 'INVALID_NUMBER', errorMessage: `${spec.label} 숫자 형식이 아닙니다.`, severity: 'ERROR', originalValue }); else { mapped[spec.target] = parsed; if (spec.nonNegative && parsed < 0) issues.push({ fieldName: spec.target, errorCode: 'NEGATIVE_VALUE', errorMessage: `${spec.label} 음수는 허용되지 않습니다.`, severity: 'ERROR', originalValue }); } }
      else if (spec.type === 'date') { const parsed = dateValue(originalValue); if (parsed === null) issues.push({ fieldName: spec.target, errorCode: 'INVALID_DATE', errorMessage: `${spec.label} 날짜 형식을 확인하세요. YYYY-MM-DD 형식만 허용합니다.`, severity: 'ERROR', originalValue }); else mapped[spec.target] = parsed; }
      else if (spec.type === 'boolean') { const parsed = boolValue(originalValue); if (parsed === null) issues.push({ fieldName: spec.target, errorCode: 'INVALID_BOOLEAN', errorMessage: `${spec.label} boolean 형식을 확인하세요.`, severity: 'ERROR', originalValue }); else mapped[spec.target] = parsed; }
      else mapped[spec.target] = String(originalValue).trim();
      if (spec.relation === 'item' && context.itemIds && !context.itemIds.has(String(originalValue).trim())) issues.push({ fieldName: spec.target, errorCode: 'ITEM_NOT_FOUND', errorMessage: `품목 마스터에 없는 품목코드입니다: ${originalValue}`, severity: 'ERROR', originalValue });
      if (spec.relation === 'supplier' && context.supplierIds && !context.supplierIds.has(String(originalValue).trim())) issues.push({ fieldName: spec.target, errorCode: 'SUPPLIER_NOT_FOUND', errorMessage: `공급업체 마스터에 없는 공급업체입니다: ${originalValue}`, severity: 'ERROR', originalValue });
    }
    const identity = JSON.stringify(mapped);
    if (seen.has(identity)) issues.push({ fieldName: '', errorCode: 'DUPLICATE_ROW', errorMessage: '동일한 매핑 데이터가 중복됩니다.', severity: 'WARNING', originalValue: original });
    seen.add(identity);
    const orderDate = mapped['발주일'] ?? mapped.order_date; const dueDate = mapped['납기예정일'] ?? mapped.due_date; const receiptDate = mapped['입고일'] ?? mapped.receipt_date;
    if (orderDate && dueDate && String(dueDate) < String(orderDate)) issues.push({ fieldName: '납기예정일', errorCode: 'DATE_ORDER_ERROR', errorMessage: '납기예정일이 발주일보다 빠릅니다.', severity: 'ERROR', originalValue: dueDate });
    if (orderDate && receiptDate && String(receiptDate) < String(orderDate)) issues.push({ fieldName: '입고일', errorCode: 'DATE_ORDER_ERROR', errorMessage: '입고일이 발주일보다 빠릅니다.', severity: 'ERROR', originalValue: receiptDate });
    const status = issues.some((issue) => issue.severity === 'ERROR') ? 'ERROR' : issues.length ? 'WARNING' : 'SUCCESS';
    return { rowNumber: index + 2, original, mapped, status, issues };
  });
}

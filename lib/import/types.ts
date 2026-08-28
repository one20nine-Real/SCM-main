export const IMPORT_TYPES = [
  'usage_history', 'inventory', 'item_master', 'supplier_master',
  'purchase_order', 'goods_receipt', 'sales_order', 'business_event', 'item_substitute',
] as const;

export type ImportType = (typeof IMPORT_TYPES)[number];
export type ImportMode = 'append' | 'upsert' | 'replace';
export type ValidationSeverity = 'SUCCESS' | 'WARNING' | 'ERROR';

export type ParsedRow = Record<string, unknown>;
export type ParsedFile = { headers: string[]; rows: ParsedRow[] };
export type FieldSpec = {
  key: string;
  target: string;
  label: string;
  aliases: string[];
  type: 'text' | 'number' | 'date' | 'boolean';
  required?: boolean;
  nonNegative?: boolean;
  relation?: 'item' | 'supplier';
};
export type ImportSchema = { type: ImportType; label: string; table: string; fields: FieldSpec[] };
export type ValidationIssue = {
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  severity: Exclude<ValidationSeverity, 'SUCCESS'>;
  originalValue: unknown;
};
export type ValidatedRow = {
  rowNumber: number;
  original: ParsedRow;
  mapped: ParsedRow;
  status: ValidationSeverity;
  issues: ValidationIssue[];
};


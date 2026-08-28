import type { ReactNode } from 'react';
import DataTable, { type UiColumn } from '@/components/ui/data-table';

export type Column<T> = UiColumn<T>;
export function formatNumber(value: number | null, suffix = '') { return value === null ? '— + NO_DATA' : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`; }
export default function LegacyDataTable<T extends Record<string, unknown>>(props: { columns: Column<T>[]; rows: T[]; empty?: string; rowKey?: (row: T, index: number) => string }) { return <DataTable {...props} />; }

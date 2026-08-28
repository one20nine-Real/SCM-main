import type { ReactNode } from 'react';
import EmptyValue from './empty-value';
export type UiColumn<T> = { key: string; label: string; align?: 'left' | 'right' | 'center'; render?: (row: T) => ReactNode };
export default function DataTable<T extends Record<string, unknown>>({ columns, rows, rowKey, empty = '표시할 데이터가 없습니다.' }: { columns: UiColumn<T>[]; rows: T[]; rowKey?: (row: T, index: number) => string; empty?: string }) {
  if (rows.length === 0) return <EmptyValue reasonCode="NO_DATA" label={empty} />;
  return <div className="ui-table-wrap"><table className="ui-data-table"><thead><tr>{columns.map((column) => <th key={column.key} style={{ textAlign: column.align }}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey?.(row, index) ?? String(index)}>{columns.map((column) => <td key={column.key} style={{ textAlign: column.align }}>{column.render ? column.render(row) : String(row[column.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>;
}

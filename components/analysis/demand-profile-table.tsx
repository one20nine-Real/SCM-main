'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import { filterDemandProfiles } from '@/lib/demand-profile-model';
import type { DemandProfile, DemandType } from '@/lib/scm-model';

const types: (DemandType | 'ALL')[] = ['ALL', 'SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'];
const numberText = (value: number | null, digits = 2) => value === null ? <EmptyValue reasonCode="NO_DATA" /> : value.toFixed(digits);
const percentText = (value: number | null) => value === null ? <EmptyValue reasonCode="NO_DATA" /> : `${(value * 100).toFixed(1)}%`;
const typeLabel: Record<DemandType, string> = { SMOOTH: 'SMOOTH', INTERMITTENT: 'INTERMITTENT', ERRATIC: 'ERRATIC', LUMPY: 'LUMPY' };

export default function DemandProfileTable({ rows }: { rows: DemandProfile[] }) {
  const [demandType, setDemandType] = useState<DemandType | 'ALL'>('ALL'); const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all'); const [sku, setSku] = useState('');
  const filtered = useMemo(() => filterDemandProfiles(rows, { demandType, availability, sku }), [rows, demandType, availability, sku]);
  const columns: UiColumn<DemandProfile>[] = [
    { key: 'itemId', label: 'SKU' }, { key: 'itemName', label: '품목명' }, { key: 'adi', label: 'ADI', align: 'right', render: (row) => numberText(row.adi) }, { key: 'cvSquared', label: 'CV²', align: 'right', render: (row) => numberText(row.cvSquared) }, { key: 'zeroDemandRate', label: 'Zero-demand Rate', align: 'right', render: (row) => percentText(row.zeroDemandRate) }, { key: 'trend', label: 'Trend', align: 'right', render: (row) => numberText(row.trend) },
    { key: 'demandType', label: 'Demand Type', align: 'center', render: (row) => row.demandType ? <Badge status="INFO">{typeLabel[row.demandType]}</Badge> : <EmptyValue reasonCode={row.reasonCode ?? 'NO_DATA'} /> }, { key: 'seasonality', label: 'Seasonality', render: (row) => row.seasonality ?? <EmptyValue reasonCode={row.periods < 24 ? 'INSUFFICIENT_PERIODS' : 'NO_DATA'} /> }, { key: 'reasonCode', label: 'Reason', render: (row) => row.reasonCode ? <EmptyValue reasonCode={row.reasonCode} /> : <span className="muted">—</span> },
  ];
  return <><div className="filter-row"><label>Demand Type<select value={demandType} onChange={(event) => setDemandType(event.target.value as DemandType | 'ALL')}>{types.map((type) => <option key={type} value={type}>{type === 'ALL' ? '전체' : type}</option>)}</select></label><label>계산 상태<select value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="all">전체</option><option value="available">계산 가능</option><option value="unavailable">계산 불가</option></select></label><label>SKU 검색<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU 또는 품목명" /></label></div><DataTable columns={columns} rows={filtered} rowKey={(row) => row.itemId} empty="표시할 Demand Profile이 없습니다." /></>;
}


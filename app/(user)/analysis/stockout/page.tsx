import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Badge from '@/components/ui/badge';
import { getInventoryProjection, getStockoutKpi } from '@/lib/scm';
import type { InventoryProjection } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';
const number = (value: number | null, suffix = '') => value === null ? <EmptyValue reasonCode="NO_DATA" /> : <>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</>;
const columns: UiColumn<InventoryProjection>[] = [
  { key: 'period', label: 'Period' }, { key: 'beginningInventory', label: 'Beginning Inventory', align: 'right', render: (r) => number(r.beginningInventory) },
  { key: 'scheduledReceipt', label: 'Scheduled Receipt', align: 'right', render: (r) => number(r.scheduledReceipt) }, { key: 'confirmedSalesOrder', label: 'Confirmed Sales Order', align: 'right', render: (r) => number(r.confirmedSalesOrder) },
  { key: 'softAllocation', label: 'Soft Allocation', align: 'right', render: (r) => number(r.softAllocation) }, { key: 'forecastDemand', label: 'Forecast Demand', align: 'right', render: (r) => r.forecastDemand === null ? <EmptyValue reasonCode={r.reasonCode ?? 'NO_FORECAST'} /> : number(r.forecastDemand) },
  { key: 'endingInventory', label: 'Ending Projected Inventory', align: 'right', render: (r) => r.endingInventory === null ? <EmptyValue reasonCode={r.reasonCode ?? 'NO_DATA'} /> : number(r.endingInventory) }, { key: 'stockoutPeriod', label: 'Stockout Period', render: (r) => r.stockoutPeriod ? r.stockoutPeriod.slice(0, 10).replaceAll('-', '.') : <span className="muted">없음</span> },
  { key: 'daysOfSupply', label: 'Days of Supply', align: 'right', render: (r) => r.daysOfSupply === null ? <EmptyValue reasonCode={r.reasonCode ?? 'NO_DATA'} /> : number(r.daysOfSupply, '일') }, { key: 'riskStatus', label: 'Risk Status', align: 'center', render: (r) => <Badge status={r.riskStatus} /> },
  { key: 'reasonCode', label: 'Reason Code', render: (r) => r.reasonCode ? <EmptyValue reasonCode={r.reasonCode} /> : <span className="muted">—</span> },
];

export default async function StockoutPage() {
  const [projection, kpiResult] = await Promise.all([getInventoryProjection(), getStockoutKpi()]);
  const kpi = kpiResult.data;
  return <><PageHeader title="Inventory Projection / Stockout Risk" description="Champion Forecast와 현재 재고, 예정입고, 확정수주, 가예약을 결합한 기간별 재고 전망입니다." /><div className="ui-grid ui-grid-4"><KpiCard label="전체 품목" value={kpi?.items ?? <EmptyValue reasonCode="NO_DATA" />} /><KpiCard label="Critical" value={kpi?.critical ?? <EmptyValue reasonCode="NO_DATA" />} status="CRITICAL" /><KpiCard label="Warning" value={kpi?.warning ?? 0} status="WARNING" /><KpiCard label="계산 불가" value={kpi?.unknown ?? <EmptyValue reasonCode="NO_DATA" />} status="CALCULATION_UNAVAILABLE" /></div>{kpiResult.error && <Panel className="section"><p className="text-danger">KPI 조회에 실패했습니다: {kpiResult.error}</p></Panel>}<Panel className="section" title="기간별 Inventory Projection" description="Ending = Beginning + Scheduled Receipt − Confirmed Sales Order − Soft Allocation − Forecast Demand">{projection.error ? <p className="text-danger">조회에 실패했습니다: {projection.error}</p> : <DataTable columns={columns} rows={projection.rows} rowKey={(r, i) => `${r.itemId}-${r.period}-${i}`} empty="데이터가 없습니다. analytics.v_inventory_projection을 확인하세요." />}</Panel></>;
}

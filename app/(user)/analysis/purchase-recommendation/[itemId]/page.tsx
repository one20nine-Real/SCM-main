import { notFound } from 'next/navigation';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import { getInventoryProjectionForItem, getPurchaseRecommendation } from '@/lib/scm';
import type { InventoryProjection } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';
const n = (value: number | null) => value === null ? <EmptyValue reasonCode="CALCULATION_UNAVAILABLE" /> : Number.isInteger(value) ? value : value.toFixed(1);
const projectionColumns: UiColumn<InventoryProjection>[] = [
  { key: 'period', label: 'Period' }, { key: 'beginningInventory', label: 'Beginning', align: 'right', render: (r) => n(r.beginningInventory) }, { key: 'scheduledReceipt', label: 'Receipt', align: 'right', render: (r) => n(r.scheduledReceipt) }, { key: 'confirmedSalesOrder', label: 'Confirmed', align: 'right', render: (r) => n(r.confirmedSalesOrder) }, { key: 'softAllocation', label: 'Soft Allocation', align: 'right', render: (r) => n(r.softAllocation) }, { key: 'forecastDemand', label: 'Forecast', align: 'right', render: (r) => n(r.forecastDemand) }, { key: 'endingInventory', label: 'Ending', align: 'right', render: (r) => n(r.endingInventory) }, { key: 'riskStatus', label: 'Risk', render: (r) => <Badge status={r.riskStatus} /> },
];
export default async function PurchaseRecommendationDetail({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const [recommendation, projection] = await Promise.all([getPurchaseRecommendation(decodeURIComponent(itemId)), getInventoryProjectionForItem(decodeURIComponent(itemId))]);
  if (!recommendation.data && !recommendation.error) notFound();
  const r = recommendation.data;
  return <><PageHeader title={`${r?.itemId ?? itemId} 발주 근거`} description="Forecast → Inventory Projection → Safety Stock → Stockout → Purchase Recommendation" />{recommendation.error ? <p className="text-danger">조회에 실패했습니다: {recommendation.error}</p> : r && <><div className="ui-grid ui-grid-4"><Panel title="수요 기준"><strong>{n(r.demandBasisQty)}</strong><p className="muted">Forecast {n(r.forecastQty)} · 확정수주 {n(r.confirmedOrderQty)}</p></Panel><Panel title="Safety Stock"><strong>{n(r.safetyStock)}</strong><p className="muted">Effective LT {n(r.effectiveLeadtime)}일</p></Panel><Panel title="필요량"><strong>{n(r.requiredQty)}</strong><p className="muted">재고 {n(r.availableInventory)} · Open PO {n(r.scheduledReceipt)}</p></Panel><Panel title="추천"><strong>{n(r.recommendedQty)}</strong><p className="muted">{r.calculationStatus === 'NO_ORDER_REQUIRED' ? '발주 불필요' : r.isImmediate ? '즉시 발주' : r.recommendedOrderDate ?? '권고일 계산 불가'}</p></Panel></div><Panel className="section" title="Inventory Projection">{projection.error ? <p className="text-danger">조회에 실패했습니다: {projection.error}</p> : <DataTable columns={projectionColumns} rows={projection.rows} rowKey={(row) => `${row.itemId}-${row.period}`} />}</Panel><Panel className="section" title="Calculation Trace"><pre className="calculation-trace">{JSON.stringify(r.calculationTrace, null, 2)}</pre></Panel></>}</>;
}

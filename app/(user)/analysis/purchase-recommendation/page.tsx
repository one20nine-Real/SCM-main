import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Badge from '@/components/ui/badge';
import { getPurchaseRecommendations } from '@/lib/scm';
import type { PurchaseRecommendation } from '@/lib/scm-model';
import { toBadgeStatus } from '@/lib/design-system';

export const dynamic = 'force-dynamic';
const number = (value: number | null, suffix = '') => value === null ? <EmptyValue reasonCode="CALCULATION_UNAVAILABLE" /> : <>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</>;
const date = (value: string | null) => value ? value.slice(0, 10) : <EmptyValue reasonCode="NO_STOCKOUT_DATE" />;
const columns: UiColumn<PurchaseRecommendation>[] = [
  { key: 'itemId', label: 'SKU', render: (r) => <Link href={`/analysis/purchase-recommendation/${encodeURIComponent(r.itemId)}`}>{r.itemId}</Link> },
  { key: 'itemName', label: '품목명' },
  { key: 'riskStatus', label: 'Risk', render: (r) => <Badge status={toBadgeStatus(r.riskStatus)} /> },
  { key: 'forecastQty', label: 'Forecast', align: 'right', render: (r) => number(r.forecastQty) },
  { key: 'confirmedOrderQty', label: '확정수주', align: 'right', render: (r) => number(r.confirmedOrderQty) },
  { key: 'availableInventory', label: '재고', align: 'right', render: (r) => number(r.availableInventory) },
  { key: 'safetyStock', label: 'Safety Stock', align: 'right', render: (r) => number(r.safetyStock) },
  { key: 'stockoutDate', label: 'Stockout', render: (r) => date(r.stockoutDate) },
  { key: 'requiredQty', label: '필요량', align: 'right', render: (r) => number(r.requiredQty) },
  { key: 'moq', label: 'MOQ', align: 'right', render: (r) => number(r.moq) },
  { key: 'packSize', label: 'Pack', align: 'right', render: (r) => number(r.packSize) },
  { key: 'recommendedQty', label: '추천수량', align: 'right', render: (r) => r.calculationStatus === 'NO_ORDER_REQUIRED' ? <>0 <span className="muted">(불필요)</span></> : number(r.recommendedQty) },
  { key: 'recommendedOrderDate', label: '권고일', render: (r) => <>{date(r.recommendedOrderDate)}{r.isImmediate && <Badge status="CRITICAL">즉시</Badge>}</> },
  { key: 'reasonCode', label: '사유', render: (r) => r.reasonCode ? <EmptyValue reasonCode={r.reasonCode} /> : '—' },
];

export default async function PurchaseRecommendationPage() {
  const { rows, error } = await getPurchaseRecommendations();
  return <><PageHeader title="발주 추천" description="Champion Forecast, 재고, 리드타임 변동성과 발주 정책을 연결한 SQL 계산 결과입니다." /><Panel className="section" title="SKU별 발주 추천" description="상세 화면에서 계산 근거를 확인할 수 있습니다.">{error ? <p className="text-danger">조회에 실패했습니다: {error}</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.itemId} empty="analytics.v_purchase_recommendation을 확인하세요." />}</Panel></>;
}

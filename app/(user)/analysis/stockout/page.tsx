import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Badge from '@/components/ui/badge';
import { getStockoutKpi, getStockoutRisk } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';
const formatDate = (value: string | null) => value ? value.slice(0, 10).replaceAll('-', '.') : <EmptyValue reasonCode="NO_DATA" />;
const formatValue = (value: number | null, suffix = '') => value === null ? <EmptyValue reasonCode="NO_DATA" /> : <>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</>;
const reasonCode = (row: StockoutRisk) => row.reason ?? 'NO_DATA';
const columns: UiColumn<StockoutRisk>[] = [
  { key: 'itemId', label: '품목코드' }, { key: 'itemName', label: '품목명' }, { key: 'supplier', label: '공급처' }, { key: 'availableQty', label: '가용재고', align: 'right', render: (r) => formatValue(r.availableQty) }, { key: 'dailyUsageAvg', label: '일평균 사용량', align: 'right', render: (r) => formatValue(r.dailyUsageAvg) }, { key: 'stockoutDays', label: '소진까지', align: 'right', render: (r) => r.stockoutDays === null ? <><EmptyValue reasonCode={reasonCode(r)} /></> : formatValue(r.stockoutDays, '일') }, { key: 'stockoutDate', label: '소진 예상일', render: (r) => formatDate(r.stockoutDate) },
  { key: 'riskStatus', label: '상태', align: 'center', render: (r) => <Badge status={r.riskStatus === 'UNKNOWN' ? 'CALCULATION_UNAVAILABLE' : r.riskStatus} /> }, { key: 'reason', label: '사유', render: (r) => r.reason ? <EmptyValue reasonCode={r.reason} /> : <span className="muted">—</span> },
];

export default async function StockoutPage() {
  const [riskResult, kpiResult] = await Promise.all([getStockoutRisk(), getStockoutKpi()]);
  const kpi = kpiResult.data;
  return <><PageHeader title="재고 소진 위험" description="현재고와 입고예정을 기준으로 품목별 소진 예상일과 위험 상태를 확인합니다." /><div className="ui-grid ui-grid-3"><KpiCard label="전체 품목" value={kpi?.items ?? <EmptyValue reasonCode="NO_DATA" />} foot="분석 대상 품목" /><KpiCard label="위험 품목" value={kpi?.critical ?? <EmptyValue reasonCode="NO_DATA" />} status="CRITICAL" /><KpiCard label="안전 품목" value={kpi?.safe ?? <EmptyValue reasonCode="NO_DATA" />} status="SAFE" /><KpiCard label="판정 불가" value={kpi?.unknown ?? <EmptyValue reasonCode="NO_DATA" />} status="CALCULATION_UNAVAILABLE" /><KpiCard label="30일 이내 소진" value={kpi?.within30Days ?? <EmptyValue reasonCode="NO_DATA" />} status="WARNING" /><KpiCard label="평균 소진 예상" value={formatValue(kpi?.averageStockoutDays ?? null, '일')} foot="계산 가능한 품목 기준" /></div>{kpiResult.error && <Panel className="section"><p className="text-danger">KPI 조회에 실패했습니다: {kpiResult.error}</p></Panel>}<Panel className="section" title="품목별 소진 위험" description="가용재고 ÷ 일평균 사용량">{riskResult.error ? <p className="text-danger">조회에 실패했습니다: {riskResult.error}</p> : <DataTable columns={columns} rows={riskResult.rows} rowKey={(r) => r.itemId} empty="데이터가 없습니다. analytics.v_stockout_risk를 확인하세요." />}</Panel></>;
}

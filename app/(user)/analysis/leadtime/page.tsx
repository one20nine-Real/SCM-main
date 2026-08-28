import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Badge from '@/components/ui/badge';
import { getLeadtimeGap } from '@/lib/scm';
import type { LeadtimeGap } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';
const formatNumber = (value: number | null, suffix = '') => value === null ? <EmptyValue reasonCode="NO_DATA" /> : <>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</>;
const columns: UiColumn<LeadtimeGap>[] = [
  { key: 'supplier', label: '공급처' }, { key: 'country', label: '국가' }, { key: 'masterLeadTime', label: '마스터', align: 'right', render: (r) => formatNumber(r.masterLeadTime, '일') },
  { key: 'sampleCount', label: '표본수', align: 'right' }, { key: 'actualAverage', label: '실적평균', align: 'right', render: (r) => formatNumber(r.actualAverage, '일') }, { key: 'p80', label: 'P80', align: 'right', render: (r) => formatNumber(r.p80, '일') },
  { key: 'gap', label: '격차', align: 'right', render: (r) => r.gap === null ? <EmptyValue reasonCode="NO_DATA" /> : <Badge status={r.gap > 0 ? 'CRITICAL' : 'SAFE'}>{`${r.gap > 0 ? '+' : ''}${r.gap.toFixed(1)}일`}</Badge> },
];

export default async function LeadtimePage() {
  const { rows, error } = await getLeadtimeGap();
  return <><PageHeader title="리드타임 격차" description="마스터 표준 리드타임과 실제 실적 P80을 비교합니다." /><div className="ui-grid ui-grid-3"><KpiCard label="공급처" value={rows.length} foot="사용 중인 생산법인" /><KpiCard label="실제가 더 김" value={rows.filter((r) => r.gap !== null && r.gap > 0).length} status="WARNING" /><KpiCard label="표본 부족" value={rows.filter((r) => r.sampleCount < 10).length} foot="표본 10건 미만" /></div><Panel className="section" title="공급처별 리드타임" description="격차 = P80 − 마스터">{error ? <p className="text-danger">조회에 실패했습니다: {error}</p> : <DataTable columns={columns} rows={rows} rowKey={(r, i) => `${r.supplier}-${i}`} empty="데이터가 없습니다. analytics.v_leadtime_gap을 확인하세요." />}</Panel></>;
}

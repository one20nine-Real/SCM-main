import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import EmptyValue from '@/components/ui/empty-value';
import DemandProfileTable from '@/components/analysis/demand-profile-table';
import { getDemandProfileKpi, getDemandProfiles } from '@/lib/scm';

export const dynamic = 'force-dynamic';
export default async function DemandProfilePage() {
  const [profileResult, kpiResult] = await Promise.all([getDemandProfiles(), getDemandProfileKpi()]); const kpi = kpiResult.data;
  return <><PageHeader title="SKU 수요 프로파일" description="학습기간 수요만으로 SKU의 발생 간격과 변동성을 분류합니다." /><div className="ui-grid ui-grid-4"><KpiCard label="전체 SKU" value={kpi?.totalItems ?? <EmptyValue reasonCode="NO_DATA" />} /><KpiCard label="SMOOTH" value={kpi?.smooth ?? <EmptyValue reasonCode="NO_DATA" />} status="SAFE" /><KpiCard label="INTERMITTENT + LUMPY" value={kpi?.crostonNeeded ?? <EmptyValue reasonCode="NO_DATA" />} status="WARNING" /><KpiCard label="계산 불가" value={kpi?.calculationUnavailable ?? <EmptyValue reasonCode="NO_DATA" />} status="CALCULATION_UNAVAILABLE" /></div>{kpiResult.error && <Panel className="section"><p className="text-danger">KPI 조회에 실패했습니다: {kpiResult.error}</p></Panel>}<Panel className="section" title="SKU별 Demand Profile" description="SBC 기준: ADI 1.32, CV² 0.49 경계">{profileResult.error ? <p className="text-danger">조회에 실패했습니다: {profileResult.error}</p> : <DemandProfileTable rows={profileResult.rows} />}</Panel></>;
}


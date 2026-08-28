import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import InsightBanner from '@/components/ui/insight-banner';

export default function DashboardPage() {
  return <><PageHeader eyebrow="OVERVIEW" title="전체 현황" description="월간 발주계획과 분석 화면으로 이동하는 시작점입니다." /><div className="ui-grid ui-grid-4"><KpiCard label="업무 플로우" value="6" foot="월간 발주계획 단계" /><KpiCard label="분석 화면" value="2" foot="Lead Time · Stockout" /><KpiCard label="연결 상태" value="LIVE" status="SAFE" /><KpiCard label="관리 기준월" value="2026.09" foot="현재 계획 기준" /></div><Panel className="section" title="빠른 이동" description="공통 디자인 시스템으로 구성된 주요 화면입니다."><div className="button-row"><Link className="button primary" href="/analysis/leadtime">Lead Time 분석</Link><Link className="button" href="/analysis/stockout">Stockout Risk 분석</Link><Link className="button" href="/workflow">레거시 업무 플로우</Link></div></Panel><InsightBanner title="다음 단계">분석 결과를 확인한 뒤 관리자 메뉴에서 기준값과 운영 설정을 관리할 수 있습니다.</InsightBanner></>;
}

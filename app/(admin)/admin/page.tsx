import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';

export default function AdminPage() {
  return <><PageHeader eyebrow="ADMIN" title="관리자 설정" description="운영 기준과 연결 상태를 확인하는 관리자 화면입니다." /><Panel title="운영 상태" description="실제 DB 계산 로직은 변경하지 않고 상태만 표시합니다."><div className="ui-alert-row"><div><strong>데이터 연결</strong><p>분석 뷰와 공통 라우팅이 준비되어 있습니다.</p></div><Badge status="SAFE" /></div></Panel></>;
}

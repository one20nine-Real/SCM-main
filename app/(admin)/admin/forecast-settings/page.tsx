import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import { getForecastSettings } from '@/lib/scm';

export const dynamic = 'force-dynamic';
const date = (value: string | null) => value ? value.slice(0, 10).replaceAll('-', '.') : <EmptyValue reasonCode="NO_DATA" />;

export default async function ForecastSettingsPage() {
  const result = await getForecastSettings();
  const settings = result.data;
  return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 설정" description="학습·검증 기간과 공통 정책값을 확인합니다." />{result.error ? <Panel><p className="text-danger">설정을 조회하지 못했습니다: {result.error}</p></Panel> : !settings ? <Panel><EmptyValue reasonCode="NO_DATA" label="Forecast 설정이 없습니다." /></Panel> : <div className="ui-grid ui-grid-2"><Panel title="데이터 기간" description="analytics.v_forecast_settings"><div className="settings-list"><div><span>전체 데이터</span><b>{date(settings.dataStart)} ~ {date(settings.dataEnd)}</b></div><div><span>학습 기간</span><b>{date(settings.trainStart)} ~ {date(settings.trainEnd)}</b></div><div><span>검증 기간</span><b>{date(settings.testStart)} ~ {date(settings.testEnd)}</b></div><div><span>Granularity</span><b>{settings.granularity}</b></div></div></Panel><Panel title="격리 상태" description="학습·검증 데이터 경계"><div className="settings-list"><div><span>Train window</span><Badge status={settings.trainWindowOk ? 'SAFE' : 'CRITICAL'}>{settings.trainWindowOk ? '정상' : '범위 부족'}</Badge></div><div><span>Test window</span><Badge status={settings.testWindowOk ? 'SAFE' : 'CRITICAL'}>{settings.testWindowOk ? '정상' : '범위 부족'}</Badge></div><div><span>Windows disjoint</span><Badge status={settings.windowsDisjoint ? 'SAFE' : 'CRITICAL'}>{settings.windowsDisjoint ? '분리됨' : '겹침'}</Badge></div><div><span>행 수</span><b>train {settings.trainRowCount.toLocaleString()} · test {settings.testRowCount.toLocaleString()}</b></div></div></Panel><Panel className="section" title="정책값" description="core.policy_config"><div className="settings-list"><div><span>Service level</span><b>{settings.serviceLevel ?? <EmptyValue reasonCode="NO_DATA" />}</b></div><div><span>Review period</span><b>{settings.reviewPeriodDays ?? <EmptyValue reasonCode="NO_DATA" />}일</b></div><div><span>Safety buffer</span><b>{settings.safetyBufferDays ?? <EmptyValue reasonCode="NO_DATA" />}일</b></div></div></Panel></div>}</>;
}

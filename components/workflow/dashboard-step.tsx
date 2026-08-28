import { ArrowRight, CheckCircle2, FileText, Plus, TriangleAlert } from 'lucide-react';
import type { StepId } from '@/components/procurement-app';
import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import InsightBanner from '@/components/ui/insight-banner';

export default function DashboardStep({ onStart, onOpenStep }: { onStart: () => void; onOpenStep: (id: StepId) => void }) {
  const cards = [{ id: 'report' as StepId, label: '당월 총 발주금액', value: '₩107.2M', foot: '전월 대비 +8.4%' }, { id: 'demand' as StepId, label: '수요 확정 상태', value: '진행 중', foot: 'OL 검증 완료 · 회의 확정 대기' }, { id: 'calculation' as StepId, label: '발주량 예외', value: '2건', foot: 'Flex 1 · MOQ 1' }, { id: 'report' as StepId, label: '보고자료', value: '준비 중', foot: '계산 완료 후 생성 가능' }];
  return <><PageHeader eyebrow="PLANNING RUN / 2026.09" title="월간 발주계획 현황" description="수요 확정부터 보고자료 생성까지, 이번 달 업무 진행상태를 한눈에 확인합니다." action={<div className="button-row"><Button onClick={() => onOpenStep('report')}><FileText size={14} /> 보고자료 미리보기</Button><Button variant="primary" onClick={onStart}><Plus size={14} /> 새 발주계획 시작</Button></div>} /><div className="ui-grid ui-grid-4">{cards.map((card) => <button className="workflow-kpi-link" key={card.label} onClick={() => onOpenStep(card.id)}><KpiCard label={card.label} value={card.value} foot={card.foot} /></button>)}</div><div className="ui-grid ui-grid-2 section"><Panel title="프로세스 준비상태" description="현재 진행 현황"><div className="checklist">{[['수요 자료 취합 및 검증', true], ['수급회의 결과 반영', false], ['전월말 재고·Open PO 입력', false], ['기기·옵션 발주량 계산', false], ['보고자료 생성', false]].map(([label, done]) => <div className="check-row" key={label as string}><div className="check-label"><span className={`check-icon ${done ? '' : 'pending'}`}>{done ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />}</span>{label as string}</div><Badge status={done ? 'SAFE' : 'WARNING'}>{done ? '완료' : '대기'}</Badge></div>)}</div></Panel><Panel title="이번 달 업무 진입" description="2026년 09월"><InsightBanner title="안내">전체 플로우를 먼저 확인하세요. 실제 입력·계산·저장은 다음 구현 단계에서 활성화됩니다.</InsightBanner><Button className="workflow-start-button" variant="primary" onClick={onStart}>수요 확정부터 시작 <ArrowRight size={14} /></Button></Panel></div></>;
}

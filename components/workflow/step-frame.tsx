import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/button';

export default function StepFrame({ children, onNext, onBack, nextLabel = '다음 단계' }: { children: React.ReactNode; onNext: () => void; onBack: () => void; nextLabel?: string }) {
  return <><div>{children}</div><div className="step-footer"><span>현재는 전체 플로우 확인용 프로토타입입니다.</span><div className="button-row"><Button onClick={onBack}><ArrowLeft size={14} /> 이전 단계</Button><Button variant="primary" onClick={onNext}>{nextLabel} <ArrowRight size={14} /></Button></div></div></>;
}

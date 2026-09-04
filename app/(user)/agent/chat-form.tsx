'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Button from '@/components/ui/button';
import Panel from '@/components/ui/panel';
import type { AgentAnswer } from '@/lib/agent/schema';
import { askAgentAction } from './actions';
import { initialAgentState } from './state';

const examples = [
  '602K02693의 최근 출고 추세를 알려줘',
  '602K02693의 수요 유형과 변동성을 알려줘',
  'MDL121의 Sales OL과 SCM OL 정확도를 비교해줘',
  'MDL121 한 대에 필요한 BOM을 알려줘',
];

function verdictClass(answer: AgentAnswer) {
  if (answer.cannot_answer) return 'gray';
  if (answer.verdict.toUpperCase().includes('CRITICAL')) return 'red';
  if (answer.verdict.toUpperCase().includes('WARNING')) return 'amber';
  return 'green';
}

function AnswerCard({ answer, trace }: { answer: AgentAnswer; trace: AgentUiState['trace'] }) {
  return <div className="agent-results" aria-live="polite">
    <Panel title="Structured Answer" description="Tool 결과에 근거해 생성된 답변입니다.">
      <div className="card-title"><h3>{answer.answer}</h3><span className={`tag ${verdictClass(answer)}`}>{answer.verdict}</span></div>
      {answer.cannot_answer ? <p className="text-danger" role="alert">계산 불가: {answer.cannot_answer_reason}</p> : <>
        <div className="grid grid-2">
          <section className="card"><div className="metric-label">Risk</div><p>{answer.risk ?? '—'}</p></section>
          <section className="card"><div className="metric-label">권고</div><p>{answer.recommended_action ?? '—'}</p></section>
        </div>
        <section className="section"><div className="card-title"><h3>근거</h3><span>{answer.evidence.length}건</span></div><div className="grid grid-2">{answer.evidence.length ? answer.evidence.map((evidence, index) => <article className="card" key={`${evidence.source}-${index}`}><div className="metric-label">{evidence.source}</div><p>{evidence.claim}</p><strong>{evidence.value}</strong></article>) : <p className="muted">표시할 근거가 없습니다.</p>}</div></section>
      </>}
      <p className="metric-foot">데이터 기준시각: {answer.data_as_of ?? '확인 불가'}</p>
    </Panel>
    <details className="card section"><summary>Tool trace ({trace.length})</summary><div className="analysis-table-wrap section"><table className="analysis-table"><thead><tr><th>Tool</th><th>Arguments</th><th>결과</th><th>시간</th><th>사유</th></tr></thead><tbody>{trace.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td><code>{item.args}</code></td><td><span className={`tag ${item.ok ? 'green' : 'red'}`}>{item.ok ? '성공' : '실패'}</span></td><td>{item.ms}ms</td><td>{item.reason ?? '—'}</td></tr>)}</tbody></table></div></details>
  </div>;
}

type AgentUiState = typeof initialAgentState;

export default function ChatForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(askAgentAction, initialAgentState);
  const [question, setQuestion] = useState('');
  const disabled = pending || !configured;

  return <div className="agent-page">
    {!configured && <Panel title="Agent 설정 필요" description="서버의 OpenAI 환경변수 설정 후 사용할 수 있습니다."><p className="text-danger">OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL을 모두 설정해주세요.</p></Panel>}
    <Panel title="무엇을 확인할까요?" description="실데이터를 조회해 근거와 함께 답변합니다.">
      <form className="form-stack" action={action}>
        <label htmlFor="agent-question">질문</label>
        <textarea id="agent-question" className="form-input" name="question" rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 602K02693의 최근 출고 추세를 알려줘" disabled={disabled} />
        <div className="button-row"><Button variant="primary" type="submit" disabled={disabled || !question.trim()}>{pending ? '조회 중…' : '질문 보내기'}</Button>{question && <Button type="button" variant="ghost" onClick={() => setQuestion('')} disabled={pending}>지우기</Button>}</div>
      </form>
      <div className="section"><div className="metric-label">예시 질문</div><div className="button-row">{examples.map((example) => <button className="button" type="button" key={example} onClick={() => setQuestion(example)} disabled={disabled}>{example}</button>)}</div></div>
      {state.error && <p className="text-danger section" role="alert">{state.error}</p>}
    </Panel>
    {state.answer && <AnswerCard answer={state.answer} trace={state.trace} />}
  </div>;
}

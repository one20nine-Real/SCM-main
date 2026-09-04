import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotAnswer } from './schema.ts';
import {
  createAgentErrorState,
  createAgentSuccessState,
  initialAgentState,
  isOpenAiConfigured,
  type AgentUiState,
} from '../../app/(user)/agent/state.ts';

test('빈 질문은 전송하지 않고 오류 상태로 표시한다', () => {
  const state = createAgentErrorState('질문을 입력해주세요.');
  assert.equal(state.status, 'error');
  assert.equal(state.error, '질문을 입력해주세요.');
  assert.equal(state.answer, null);
});

test('OpenAI 설정이 하나라도 공백이면 미설정으로 판정한다', () => {
  assert.equal(isOpenAiConfigured({ OPENAI_BASE_URL: ' https://api.openai.com/v1 ', OPENAI_API_KEY: ' key ', OPENAI_MODEL: ' ' }), false);
  assert.equal(isOpenAiConfigured({ OPENAI_BASE_URL: ' https://api.openai.com/v1 ', OPENAI_API_KEY: ' key ', OPENAI_MODEL: ' gpt-4o-mini ' }), true);
});

test('정상 답변은 Structured Answer 상태로 보존한다', () => {
  const state = createAgentSuccessState({
    answer: '정상 답변입니다.',
    verdict: 'SAFE',
    evidence: [{ source: 'lookup', claim: '재고', value: '12' }],
    data_as_of: '2026-09-04',
    risk: null,
    recommended_action: '계속 관찰하세요.',
    cannot_answer: false,
    cannot_answer_reason: null,
  }, [{ name: 'lookup', args: '{}', ok: true, ms: 4, reason: null }]);
  assert.equal(state.status, 'success');
  assert.equal(state.answer?.evidence[0].value, '12');
  assert.equal(state.trace[0].name, 'lookup');
});

test('계산 불가 답변도 오류가 아닌 답변 카드로 표시한다', () => {
  const state: AgentUiState = createAgentSuccessState(cannotAnswer('NO_DATA'), []);
  assert.equal(state.status, 'success');
  assert.equal(state.answer?.cannot_answer, true);
  assert.equal(state.answer?.cannot_answer_reason, 'NO_DATA');
});

test('초기 상태는 빈 답변과 빈 trace를 가진다', () => {
  assert.deepEqual(initialAgentState, { status: 'idle', error: null, answer: null, trace: [] });
});

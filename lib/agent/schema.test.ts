import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotAnswer, parseAgentAnswer } from './schema.ts';

const validAnswer = {
  answer: 'ITEM012는 18일 후 소진될 예정입니다.',
  verdict: 'CRITICAL',
  evidence: [
    { source: 'analytics.v_stockout_risk', claim: 'stockout_days', value: '18.0' },
  ],
  data_as_of: '2026-09-04',
  risk: 'CRITICAL',
  recommended_action: '리드타임을 고려해 즉시 발주를 검토하세요.',
  cannot_answer: false,
  cannot_answer_reason: null,
};

test('parses a complete agent answer contract', () => {
  assert.deepEqual(parseAgentAnswer(JSON.stringify(validAnswer)), validAnswer);
});

test('rejects malformed JSON', () => {
  assert.throws(() => parseAgentAnswer('{'), /올바른 JSON/);
});

test('rejects answers with missing required fields', () => {
  const { answer: _answer, ...missingAnswer } = validAnswer;
  assert.throws(() => parseAgentAnswer(JSON.stringify(missingAnswer)), /필수 필드/);
});

test('rejects calculation-unavailable answers without a reason', () => {
  assert.throws(
    () => parseAgentAnswer(JSON.stringify({ ...validAnswer, cannot_answer: true, cannot_answer_reason: null })),
    /cannot_answer_reason/,
  );
});

test('creates a complete cannot-answer response', () => {
  assert.deepEqual(cannotAnswer('사용량 데이터가 없습니다.'), {
    answer: '현재 데이터만으로는 답변할 수 없습니다.',
    verdict: 'CANNOT_ANSWER',
    evidence: [],
    data_as_of: null,
    risk: null,
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: '사용량 데이터가 없습니다.',
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotAnswer, type AgentAnswer } from './schema.ts';
import {
  buildAllowedNumberDictionary,
  extractAnswerNumbers,
  verifyAnswerNumbers,
  type ToolObservation,
} from './guardrail.ts';

const answer = (overrides: Partial<AgentAnswer> = {}): AgentAnswer => ({
  answer: '최근 출고량은 1,234.5개이고 서비스율은 25%입니다.',
  verdict: '수요는 0.25 비율로 안정적입니다.',
  evidence: [{ source: 'getShipmentTrend', claim: '최근월 출고량 1,234.5', value: '1,234.5' }],
  data_as_of: '2026-07',
  risk: 'P80 리드타임, 602K02693, MDL121 기준입니다.',
  recommended_action: '월 1,234.5개를 준비하세요.',
  cannot_answer: false,
  cannot_answer_reason: null,
  ...overrides,
});

const numericAnswer = (text: string): AgentAnswer => answer({
  answer: text,
  verdict: '',
  evidence: [],
  data_as_of: null,
  risk: null,
  recommended_action: null,
});

const observations: ToolObservation[] = [
  { toolName: 'getShipmentTrend', result: { ok: true, data: null, numbers: [1234.5, 0.25], dataAsOf: null, reason: null } },
];

test('숫자가 있는 답변의 본문과 근거 필드를 추출한다', () => {
  const numbers = extractAnswerNumbers(answer());
  assert.deepEqual(numbers.map((item) => item.value), [1234.5, 25, 0.25, 1234.5, 1234.5, 1234.5]);
});

test('품목코드·기종코드·P80·연월·날짜·목록 번호는 추출하지 않는다', () => {
  const value = numericAnswer('602K02693 MDL121 P80 2026-07 2026-07-14 1. 발주량은 12개입니다.');
  assert.deepEqual(extractAnswerNumbers(value).map((item) => item.value), [12]);
});

test('ToolResult.numbers를 toolName.key 허용 사전으로 합친다', () => {
  assert.deepEqual(buildAllowedNumberDictionary(observations), {
    'getShipmentTrend.numbers': [1234.5, 0.25],
  });
});

test('허용된 숫자만 있는 정상 답변을 통과시킨다', () => {
  const result = verifyAnswerNumbers(answer(), buildAllowedNumberDictionary(observations));
  assert.equal(result.ok, true);
});

test('천단위 쉼표와 소수 표기를 허용한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('1,234.50개입니다.'), { 'tool.numbers': [1234.5] });
  assert.equal(result.ok, true);
});

test('음수 표기를 허용한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('편차는 -12.5입니다.'), { 'tool.numbers': [-12.5] });
  assert.equal(result.ok, true);
});

test('0~1 비율은 백분율 표기를 제한적으로 허용한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('달성률은 25%입니다.'), { 'tool.numbers': [0.25] });
  assert.equal(result.ok, true);
});

test('표시 자릿수 반올림은 허용한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('평균은 12.35입니다.'), { 'tool.numbers': [12.346] });
  assert.equal(result.ok, true);
});

test('null은 허용 숫자 사전에서 제외한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('계산할 수 없습니다.'), { 'tool.numbers': [null as unknown as number, 0] });
  assert.equal(result.ok, true);
});

test('허용되지 않은 조작 숫자를 출처 없는 숫자로 보고한다', () => {
  const result = verifyAnswerNumbers(numericAnswer('재고는 999개입니다.'), { 'tool.numbers': [1234.5] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.unsupportedNumbers, [999]);
});

test('조작된 음수를 통과시키지 않는다', () => {
  const result = verifyAnswerNumbers(numericAnswer('편차는 -999입니다.'), { 'tool.numbers': [12.5] });
  assert.equal(result.ok, false);
});

test('조작된 백분율을 통과시키지 않는다', () => {
  const result = verifyAnswerNumbers(numericAnswer('달성률은 99%입니다.'), { 'tool.numbers': [0.25] });
  assert.equal(result.ok, false);
});

test('조작된 소수를 통과시키지 않는다', () => {
  const result = verifyAnswerNumbers(numericAnswer('평균은 12.99입니다.'), { 'tool.numbers': [12.346] });
  assert.equal(result.ok, false);
});

test('계산 불가 답변은 숫자가 없어 통과한다', () => {
  const result = verifyAnswerNumbers(cannotAnswer('NO_DATA'), {});
  assert.equal(result.ok, true);
});

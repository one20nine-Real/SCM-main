import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatusLabel, formatUnavailable } from './design-system.ts';

test('상태 코드는 공통 한국어 라벨로 변환된다', () => {
  assert.equal(getStatusLabel('SAFE'), '안전');
  assert.equal(getStatusLabel('WARNING'), '주의');
  assert.equal(getStatusLabel('CRITICAL'), '위험');
  assert.equal(getStatusLabel('CALCULATION_UNAVAILABLE'), '계산 불가');
});

test('계산 불가 값은 대시와 reason code를 함께 표시한다', () => {
  assert.equal(formatUnavailable('NO_USAGE'), '— + NO_USAGE');
  assert.equal(formatUnavailable('NO_LEADTIME'), '— + NO_LEADTIME');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isDateInRange, areWindowsDisjoint, isCoverageWindowValid } from './forecast-policy.ts';

test('train과 test 경계는 겹치지 않아야 한다', () => {
  assert.equal(areWindowsDisjoint({ start: '2024-01-01', end: '2024-12-31' }, { start: '2025-01-01', end: '2025-03-31' }), true);
  assert.equal(areWindowsDisjoint({ start: '2024-01-01', end: '2025-01-01' }, { start: '2025-01-01', end: '2025-03-31' }), false);
});

test('기간 경계는 양끝을 포함한다', () => {
  assert.equal(isDateInRange('2024-01-01', '2024-01-01', '2024-12-31'), true);
  assert.equal(isDateInRange('2025-01-01', '2024-01-01', '2024-12-31'), false);
});

test('실제 데이터 범위가 설정 기간을 포함할 때만 coverage가 정상이다', () => {
  assert.equal(isCoverageWindowValid('2020-01-01', '2025-12-31', '2021-01-01', '2024-12-31'), true);
  assert.equal(isCoverageWindowValid('2020-01-01', '2023-12-31', '2021-01-01', '2024-12-31'), false);
});

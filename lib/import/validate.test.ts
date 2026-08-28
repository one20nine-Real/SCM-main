import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRows } from './validate.ts';

test('필수값, 날짜, 품목 참조 오류를 숫자로 보정하지 않고 반환한다', () => {
  const result = validateRows('usage_history', [{ item_id: 'UNKNOWN', use_date: '2026-02-31', qty: null }], { itemIds: new Set(['ITEM001']) });
  assert.equal(result[0].status, 'ERROR');
  assert.deepEqual(new Set(result[0].issues.map((issue) => issue.errorCode)), new Set(['INVALID_DATE', 'REQUIRED_FIELD', 'ITEM_NOT_FOUND']));
  assert.equal(result[0].mapped.qty, undefined);
});

test('동일 행은 WARNING 중복으로 표시한다', () => {
  const result = validateRows('business_event', [{ event_id: 'E1', event_type: 'PROMO', event_date: '2026-08-01' }, { event_id: 'E1', event_type: 'PROMO', event_date: '2026-08-01' }]);
  assert.equal(result[1].status, 'WARNING');
  assert.equal(result[1].issues[0].errorCode, 'DUPLICATE_ROW');
});


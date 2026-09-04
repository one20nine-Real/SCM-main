import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20260828001000_step10_safety_stock_recommendation.sql', import.meta.url), 'utf8');

test('Safety Stock은 forecast error, lead time variability, service level을 결합한다', () => {
  assert.match(sql, /sigma_DLT/);
  assert.match(sql, /service_level_policy/);
  assert.match(sql, /z_value/);
  assert.match(sql, /stddev_samp/);
});

test('추천수량은 Forecast와 확정수주 중 큰 값을 기준으로 하고 MOQ/Pack Size를 적용한다', () => {
  assert.match(sql, /greatest\(/);
  assert.match(sql, /moq/);
  assert.match(sql, /pack_size/);
  assert.match(sql, /recommended_qty/);
});

test('계산 불가와 발주 불필요를 구분하고 계산 근거를 보존한다', () => {
  assert.match(sql, /NO_FORECAST/);
  assert.match(sql, /NO_INVENTORY_DATA/);
  assert.match(sql, /NO_LEADTIME/);
  assert.match(sql, /NO_SERVICE_LEVEL/);
  assert.match(sql, /calculation_trace/);
  assert.match(sql, /recommended_qty = 0/);
});

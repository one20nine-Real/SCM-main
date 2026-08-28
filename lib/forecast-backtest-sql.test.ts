import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20260828000600_step6_step7_forecast_backtest.sql', import.meta.url), 'utf8');

test('Forecast Engine은 등록 모델, train view, version snapshot을 사용한다', () => {
  for (const model of ['MA_3M', 'MA_6M', 'WMA_3M', 'PY_SAME_MONTH', 'SEASONAL_NAIVE']) assert.match(sql, new RegExp(`'${model}'`));
  assert.match(sql, /from core\.v_train_demand/); assert.doesNotMatch(sql, /from raw\.usage_history/);
  assert.match(sql, /insert into core\.model_version/); assert.match(sql, /data_snapshot_at/); assert.match(sql, /0\.841621/); assert.match(sql, /1\.281552/);
});

test('Backtest는 v_test_actual 기반 성능지표와 Champion 후보를 저장한다', () => {
  assert.match(sql, /from core\.v_test_actual/); assert.match(sql, /abs_error\/actual_sum/); assert.match(sql, /ACTUAL_SUM_ZERO/); assert.match(sql, /avg\(error\)/); assert.match(sql, /sqrt\(avg\(error\*error\)/); assert.match(sql, /candidate_performance/); assert.match(sql, /'AUTO'/); assert.match(sql, /'MANUAL'/);
});

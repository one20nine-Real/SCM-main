import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20260828000900_step9_inventory_projection.sql', import.meta.url), 'utf8');

test('Inventory Projection은 forecast, receipt, sales order, soft allocation을 결합한다', () => {
  assert.match(sql, /v_inventory_projection/);
  assert.match(sql, /champion_model/);
  assert.match(sql, /purchase_order/);
  assert.match(sql, /sales_order/);
  assert.match(sql, /soft_allocation/);
  assert.match(sql, /forecast_demand/);
});

test('재고·리드타임·Forecast 부족을 숫자로 보정하지 않는다', () => {
  assert.match(sql, /NO_INVENTORY_DATA/);
  assert.match(sql, /NO_LEADTIME/);
  assert.match(sql, /NO_FORECAST/);
  assert.doesNotMatch(sql, /COALESCE\(st\.current_stock,\s*0\)/);
});

test('Effective Lead Time은 확정값 이력과 P80 fallback을 제공한다', () => {
  assert.match(sql, /leadtime_policy_history/);
  assert.match(sql, /p80_days/);
  assert.match(sql, /effective_lead_time/);
});

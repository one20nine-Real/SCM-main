import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scm.ts', import.meta.url), 'utf8');

test('defines all four real-data SCM query functions', () => {
  for (const name of ['getShipmentTrend', 'getDemandProfile', 'getOlAccuracy', 'getBomRequirement']) {
    assert.match(source, new RegExp(`export async function ${name}\\(`));
  }
});

test('keeps the shipment trend on the HOC view and uses business join keys', () => {
  assert.match(source, /v_shipment_by_hoc/);
  assert.match(source, /item_code/);
  assert.match(source, /model_base/);
  assert.doesNotMatch(source, /model_key/);
});

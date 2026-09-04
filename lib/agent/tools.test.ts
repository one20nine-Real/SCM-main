import test from 'node:test';
import assert from 'node:assert/strict';
import { agentTools } from './tools.ts';

test('defines four uniquely named authenticated data tools', () => {
  assert.deepEqual(agentTools.map((tool) => tool.name), [
    'getShipmentTrend',
    'getDemandProfile',
    'getOlAccuracy',
    'getBomRequirement',
  ]);
  assert.equal(new Set(agentTools.map((tool) => tool.name)).size, 4);
  for (const tool of agentTools) {
    assert.ok(tool.description.length > 0);
    assert.deepEqual(tool.roles, ['USER', 'ADMIN']);
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
    assert.ok(Array.isArray(tool.parameters.required));
  }
});

test('인증된 USER와 ADMIN에게 실제 데이터 Tool을 노출한다', () => {
  for (const tool of agentTools) assert.deepEqual(tool.roles, ['USER', 'ADMIN']);
});

test('tools use the strict schemas expected by their arguments', () => {
  const shipment = agentTools.find((tool) => tool.name === 'getShipmentTrend')!;
  const demand = agentTools.find((tool) => tool.name === 'getDemandProfile')!;
  const accuracy = agentTools.find((tool) => tool.name === 'getOlAccuracy')!;
  const bom = agentTools.find((tool) => tool.name === 'getBomRequirement')!;

  assert.deepEqual(shipment.parameters.required, ['itemCode']);
  assert.deepEqual(demand.parameters.required, ['itemCode']);
  assert.deepEqual(accuracy.parameters.required, ['modelBase', 'fy']);
  assert.deepEqual(bom.parameters.required, ['modelBase']);
  assert.deepEqual(accuracy.parameters.properties.fy.type, ['string', 'number', 'null']);
});

test('tool results have the common result contract', async () => {
  const tool = agentTools.find((candidate) => candidate.name === 'getShipmentTrend')!;
  const result = await tool.run({ itemCode: '' });

  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.deepEqual(result.numbers, []);
  assert.equal(result.dataAsOf, null);
  assert.equal(result.reason, 'ITEM_CODE_REQUIRED');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLeadtimeGap, normalizeStockoutKpi, normalizeStockoutRisk } from './scm-model.ts';
import { toBadgeStatus } from './design-system.ts';

test('normalizes analytics leadtime rows into the screen model', () => {
  const result = normalizeLeadtimeGap({
    supplier_name: 'Fujifilm BI India',
    country: 'India',
    master_lt: 32,
    sample_count: 159,
    actual_avg: 37.6,
    p80: 44,
    gap: 12,
  });

  assert.deepEqual(result, {
    supplier: 'Fujifilm BI India',
    country: 'India',
    masterLeadTime: 32,
    sampleCount: 159,
    actualAverage: 37.6,
    p80: 44,
    gap: 12,
  });
});

test('uses Korean view aliases and safe defaults', () => {
  const result = normalizeLeadtimeGap({ 법인: 'Japan', 국가: 'Japan', 표준리드타임: 7, 표본수: 278, 실적평균: 14.5, P80: 18, 격차: 11 });
  assert.equal(result.supplier, 'Japan');
  assert.equal(result.masterLeadTime, 7);
  assert.equal(result.p80, 18);
  assert.equal(result.gap, 11);
});

test('reads the real analytics.v_leadtime_gap column names', () => {
  const result = normalizeLeadtimeGap({
    supplier_name: 'Fujifilm BI China',
    country: 'China',
    std_lead_time: 25,
    n_samples: 210,
    mean_days: 28.4,
    p80_days: 33,
    gap_days: 8,
  });

  assert.deepEqual(result, {
    supplier: 'Fujifilm BI China',
    country: 'China',
    masterLeadTime: 25,
    sampleCount: 210,
    actualAverage: 28.4,
    p80: 33,
    gap: 8,
  });
});

test('normalizes stockout risk rows and keeps unavailable calculations null', () => {
  const result = normalizeStockoutRisk({
    item_id: 'ITEM020',
    item_name: '테스트 품목',
    supplier_id: 'SUP001',
    current_stock: 10,
    inbound_qty: 5,
    available_qty: 15,
    daily_usage_avg: null,
    planned_lead_time: 18,
    stockout_days: null,
    stockout_date: null,
    risk_status: 'UNKNOWN',
    reason: 'NO_USAGE',
  });

  assert.equal(result.itemId, 'ITEM020');
  assert.equal(result.availableQty, 15);
  assert.equal(result.stockoutDays, null);
  assert.equal(result.reason, 'NO_USAGE');
  assert.equal(result.riskStatus, 'UNKNOWN');
});

test('normalizes stockout KPI values from analytics view columns', () => {
  const result = normalizeStockoutKpi({
    n_items: 20,
    n_critical: 3,
    n_safe: 15,
    n_unknown: 2,
    n_within_30d: 4,
    avg_stockout_days: 42.5,
  });

  assert.deepEqual(result, {
    items: 20,
    critical: 3,
    safe: 15,
    unknown: 2,
    within30Days: 4,
    averageStockoutDays: 42.5,
  });
});

test('converts unknown purchase recommendation risk to a supported badge status', () => {
  assert.equal(toBadgeStatus('UNKNOWN'), 'CALCULATION_UNAVAILABLE');
  assert.equal(toBadgeStatus('CRITICAL'), 'CRITICAL');
});

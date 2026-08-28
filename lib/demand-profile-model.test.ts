import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterDemandProfiles, normalizeDemandProfile, type DemandProfile } from './demand-profile-model.ts';

const base: DemandProfile = {
  itemId: 'ITEM001', itemName: '테스트', periods: 24, nonzeroPeriods: 18, adi: 1.33, cv: 0.8, cvSquared: 0.64,
  zeroDemandRate: 0.25, trend: 1.2, recentChangeRate: 0.1, peakPeriod: '2026-01', demandType: 'ERRATIC', seasonality: null,
  reasonCode: null, stability: 'ERRATIC',
};

test('Demand Profile SQL 코드를 화면 모델로 보존한다', () => {
  const result = normalizeDemandProfile({ item_id: 'ITEM001', item_name: '테스트', n_periods: 24, n_nonzero_periods: 18, adi: 1.33, cv: 0.8, cv_squared: 0.64, zero_demand_rate: 0.25, trend: 1.2, recent_change_rate: 0.1, peak_period: '2026-01', demand_type: 'ERRATIC', seasonality: null, reason_code: 'INSUFFICIENT_PERIODS', stability: 'ERRATIC' });
  assert.deepEqual(result, { ...base, reasonCode: 'INSUFFICIENT_PERIODS' });
});

test('Syntetos-Boylan-Croston 네 가지 분류와 train 격리는 SQL에 정의되어 있다', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260828000500_step5_demand_profile.sql', import.meta.url), 'utf8');
  assert.match(sql, /core\.v_train_demand/); assert.doesNotMatch(sql, /from raw\.usage_history/); assert.doesNotMatch(sql, /from core\.v_test_actual/);
  assert.match(sql, /< 1\.32 and cv \* cv < 0\.49 then 'SMOOTH'/); assert.match(sql, />= 1\.32 and cv \* cv < 0\.49 then 'INTERMITTENT'/); assert.match(sql, /< 1\.32 and cv \* cv >= 0\.49 then 'ERRATIC'/); assert.match(sql, /else 'LUMPY'/);
});

test('계산 불가 프로파일은 demand type과 reason code를 유지한다', () => {
  const result = normalizeDemandProfile({ item_id: 'ITEM002', n_periods: 12, n_nonzero_periods: 0, adi: null, cv: null, cv_squared: null, zero_demand_rate: 1, trend: null, recent_change_rate: null, peak_period: null, demand_type: null, seasonality: null, reason_code: 'NO_DEMAND', stability: null });
  assert.equal(result.demandType, null); assert.equal(result.reasonCode, 'NO_DEMAND'); assert.equal(result.adi, null);
});

test('저장된 결과만 demand type과 계산 가능 여부로 필터링한다', () => {
  const unavailable = { ...base, itemId: 'ITEM002', demandType: null, reasonCode: 'NO_DEMAND' };
  assert.deepEqual(filterDemandProfiles([base, unavailable], { demandType: 'ERRATIC', availability: 'available', sku: '' }), [base]);
  assert.deepEqual(filterDemandProfiles([base, unavailable], { demandType: 'ALL', availability: 'unavailable', sku: '002' }), [unavailable]);
});

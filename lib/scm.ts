import { createSupabaseServerClient } from './supabase';
import {
  normalizeLeadtimeGap,
  normalizeStockoutKpi,
  normalizeStockoutRisk,
  type LeadtimeGap,
  type StockoutKpi,
  type StockoutRisk,
  normalizeDemandProfile, normalizeDemandProfileKpi, type DemandProfile, type DemandProfileKpi,
  normalizeModelConfig, normalizeForecastRun, normalizeModelPerformance, normalizeForecastComparison,
  type ModelConfig, type ForecastRun, type ModelPerformance, type ForecastComparison,
} from './scm-model';
import { normalizeForecastSettings, type ForecastSettings } from './forecast-model';

export async function getLeadtimeGap(): Promise<{ rows: LeadtimeGap[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_leadtime_gap').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeLeadtimeGap(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutRisk(): Promise<{ rows: StockoutRisk[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_risk').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeStockoutRisk(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutKpi(): Promise<{ data: StockoutKpi | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_kpi').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data ? normalizeStockoutKpi(data as Record<string, unknown>) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getForecastSettings(): Promise<{ data: ForecastSettings | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_forecast_settings').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data ? normalizeForecastSettings(data as Record<string, unknown>) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Forecast 설정 조회에 실패했습니다.' };
  }
}

export async function getDemandProfiles(): Promise<{ rows: DemandProfile[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_sku_demand_profile').select('*').order('item_id'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeDemandProfile(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export async function getDemandProfileKpi(): Promise<{ data: DemandProfileKpi | null; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_demand_profile_kpi').select('*').maybeSingle(); if (error) return { data: null, error: error.message }; return { data: data ? normalizeDemandProfileKpi(data as Record<string, unknown>) : null, error: null }; } catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

async function analyticsRows<T>(view: string, normalize: (row: Record<string, unknown>) => T) { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from(view).select('*'); return { rows: (data ?? []).map((row) => normalize(row as Record<string, unknown>)), error: error?.message ?? null }; }
export async function getModelConfigs() { try { return await analyticsRows<ModelConfig>('v_model_config', normalizeModelConfig); } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Forecast 모델 조회에 실패했습니다.' }; } }
export async function getForecastRuns() { try { return await analyticsRows<ForecastRun>('v_forecast_run', normalizeForecastRun); } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Forecast 실행 이력 조회에 실패했습니다.' }; } }
export async function getModelPerformance() { try { return await analyticsRows<ModelPerformance>('v_model_performance', normalizeModelPerformance); } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Model Performance 조회에 실패했습니다.' }; } }
export async function getForecastComparison() { try { return await analyticsRows<ForecastComparison>('v_forecast_comparison', normalizeForecastComparison); } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Forecast 비교 데이터 조회에 실패했습니다.' }; } }

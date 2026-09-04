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
  normalizeLeadtimePolicy, normalizeInventoryProjection, type LeadtimePolicy, type InventoryProjection,
  normalizeSafetyStock, normalizePurchaseRecommendation, type SafetyStock, type PurchaseRecommendation,
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

export async function getLeadtimePolicies(): Promise<{ rows: LeadtimePolicy[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_leadtime_policy').select('*').order('supplier_id').order('item_id'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeLeadtimePolicy(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Lead Time 조회에 실패했습니다.' }; }
}

export async function getInventoryProjection(): Promise<{ rows: InventoryProjection[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_inventory_projection').select('*').order('item_id').order('period'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeInventoryProjection(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Inventory Projection 조회에 실패했습니다.' }; }
}
export async function getInventoryProjectionForItem(itemId: string): Promise<{ rows: InventoryProjection[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_inventory_projection').select('*').eq('item_id', itemId).order('period'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeInventoryProjection(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Inventory Projection 조회에 실패했습니다.' }; }
}
export async function getSafetyStock(): Promise<{ rows: SafetyStock[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_safety_stock').select('*').order('item_id'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeSafetyStock(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Safety Stock 조회에 실패했습니다.' }; }
}
export async function getPurchaseRecommendations(): Promise<{ rows: PurchaseRecommendation[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_purchase_recommendation').select('*').order('item_id'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizePurchaseRecommendation(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : '발주추천 조회에 실패했습니다.' }; }
}
export async function getPurchaseRecommendation(itemId: string): Promise<{ data: PurchaseRecommendation | null; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_purchase_recommendation').select('*').eq('item_id', itemId).maybeSingle(); if (error) return { data: null, error: error.message }; return { data: data ? normalizePurchaseRecommendation(data as Record<string, unknown>) : null, error: null }; } catch (error) { return { data: null, error: error instanceof Error ? error.message : '발주추천 조회에 실패했습니다.' }; }
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

type Row = Record<string, unknown>;
type ScmResult<T> = { data: T | null; error: string | null };

export type ShipmentTrend = {
  itemCode: string;
  monthly: { month: string; quantity: number }[];
  average3m: number | null;
  average6m: number | null;
  average12m: number | null;
  observedMonths: number;
  latestMonth: string | null;
  latestQuantity: number | null;
  dataAsOf: string | null;
  reason: string | null;
};

export type AgentDemandProfile = {
  itemCode: string;
  observedMonths: number;
  nonZeroMonths: number;
  adi: number | null;
  cvSquared: number | null;
  zeroDemandRate: number | null;
  demandType: 'SMOOTH' | 'ERRATIC' | 'INTERMITTENT' | 'LUMPY' | null;
  dataAsOf: string | null;
  reason: string | null;
};

export type OlAccuracy = {
  modelBase: string;
  fy: string | number | null;
  observedRows: number;
  salesOl: { wape: number | null; bias: number | null };
  scmOl: { wape: number | null; bias: number | null };
  dataAsOf: string | null;
  reason: string | null;
};

export type BomRequirement = {
  modelBase: string;
  caps: {
    capCode: string;
    options: {
      optionCode: string;
      role: string | null;
      scc: string | null;
      label: string | null;
      common: boolean;
      components: { itemCode: string; quantity: number | null }[];
    }[];
  }[];
  dataAsOf: string | null;
  reason: string | null;
};

function agentValue(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function agentString(row: Row, keys: string[]) {
  const value = agentValue(row, keys);
  return value === null ? null : String(value);
}

function agentNumber(row: Row, keys: string[]) {
  const value = agentValue(row, keys);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monthOf(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  const text = String(value ?? '');
  const match = text.match(/^(\d{4})[-/.](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : null;
}

function monthRange(first: string, last: string) {
  const result: string[] = [];
  const start = new Date(`${first}-01T00:00:00Z`);
  const end = new Date(`${last}-01T00:00:00Z`);
  for (const cursor = start; cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    result.push(cursor.toISOString().slice(0, 7));
  }
  return result;
}

function averageLast(values: number[], count: number) {
  if (values.length === 0) return null;
  const window = values.slice(-count);
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

async function factRows(table: string, itemCode: string, column: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('fact').from(table).select('*').eq(column, itemCode);
  return { rows: (data ?? []) as Row[], error };
}

export async function getShipmentTrend(itemCode: string): Promise<ScmResult<ShipmentTrend>> {
  if (!itemCode.trim()) return { data: null, error: 'ITEM_CODE_REQUIRED' };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_shipment_by_hoc').select('*').eq('item_code', itemCode);
    if (error) return { data: null, error: error.message };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return { data: null, error: 'ITEM_NOT_FOUND' };
    const quantities = new Map<string, number>();
    let dataAsOf: string | null = null;
    for (const row of rows) {
      const month = monthOf(agentValue(row, ['month', 'hoc_month', 'shipment_month', 'ship_month', 'period']));
      if (!month) continue;
      quantities.set(month, (quantities.get(month) ?? 0) + (agentNumber(row, ['shipment_qty', 'quantity', 'qty', 'ship_qty']) ?? 0));
      dataAsOf = agentString(row, ['data_as_of', 'snapshot_date', 'updated_at']) ?? dataAsOf;
    }
    const months = Array.from(quantities.keys()).sort();
    if (months.length === 0) return { data: null, error: 'NO_MONTHLY_DATA' };
    const denseMonths = monthRange(months[0], months[months.length - 1]);
    const denseValues = denseMonths.map((month) => quantities.get(month) ?? 0);
    const latestMonth = months[months.length - 1];
    return { data: { itemCode, monthly: denseMonths.map((month, index) => ({ month, quantity: denseValues[index] })), average3m: averageLast(denseValues, 3), average6m: averageLast(denseValues, 6), average12m: averageLast(denseValues, 12), observedMonths: months.length, latestMonth, latestQuantity: quantities.get(latestMonth) ?? 0, dataAsOf, reason: null }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '출고 추세 조회에 실패했습니다.' };
  }
}

export async function getDemandProfile(itemCode: string): Promise<ScmResult<AgentDemandProfile>> {
  if (!itemCode.trim()) return { data: null, error: 'ITEM_CODE_REQUIRED' };
  try {
    const { rows, error } = await factRows('fact_shipment', itemCode, 'item_code');
    if (error) return { data: null, error: error.message };
    if (rows.length === 0) return { data: null, error: 'ITEM_NOT_FOUND' };
    const quantities = new Map<string, number>();
    let dataAsOf: string | null = null;
    for (const row of rows) {
      const month = monthOf(agentValue(row, ['month', 'shipment_month', 'ship_month', 'shipment_date', 'ship_date', 'date']));
      if (!month) continue;
      quantities.set(month, (quantities.get(month) ?? 0) + (agentNumber(row, ['shipment_qty', 'quantity', 'qty']) ?? 0));
      dataAsOf = agentString(row, ['data_as_of', 'snapshot_date', 'updated_at']) ?? dataAsOf;
    }
    const months = Array.from(quantities.keys()).sort();
    if (months.length === 0) return { data: null, error: 'NO_MONTHLY_DATA' };
    const values = monthRange(months[0], months[months.length - 1]).map((month) => quantities.get(month) ?? 0);
    const nonZeroMonths = values.filter((value) => value > 0).length;
    const observedMonths = months.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const adi = nonZeroMonths === 0 ? null : observedMonths / nonZeroMonths;
    const cvSquared = mean === 0 ? null : variance / (mean ** 2);
    const zeroDemandRate = values.length === 0 ? null : (values.length - nonZeroMonths) / values.length;
    let demandType: AgentDemandProfile['demandType'] = null;
    let reason: string | null = null;
    if (observedMonths < 6) reason = 'INSUFFICIENT_HISTORY';
    else if (adi !== null && cvSquared !== null) {
      demandType = adi < 1.32 ? (cvSquared < 0.49 ? 'SMOOTH' : 'ERRATIC') : (cvSquared < 0.49 ? 'INTERMITTENT' : 'LUMPY');
    }
    return { data: { itemCode, observedMonths, nonZeroMonths, adi, cvSquared, zeroDemandRate, demandType, dataAsOf, reason }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '수요 프로파일 조회에 실패했습니다.' };
  }
}

export async function getOlAccuracy(modelBase: string, fy?: string | number): Promise<ScmResult<OlAccuracy>> {
  if (!modelBase.trim()) return { data: null, error: 'MODEL_BASE_REQUIRED' };
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.schema('fact').from('fact_mc_plan_actual').select('*').eq('model_base', modelBase);
    if (fy !== undefined) query = query.eq('fy', fy);
    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return { data: null, error: 'MODEL_NOT_FOUND' };
    const scored = rows.filter((row) => agentValue(row, ['act', 'actual', 'actual_qty']) !== null);
    const actualTotal = scored.reduce((sum, row) => sum + (agentNumber(row, ['act', 'actual', 'actual_qty']) ?? 0), 0);
    let reason: string | null = null;
    const metric = (keys: string[]): { wape: number | null; bias: number | null } => actualTotal === 0 ? { wape: null, bias: null } : { wape: scored.reduce((sum, row) => sum + Math.abs((agentNumber(row, keys) ?? 0) - (agentNumber(row, ['act', 'actual', 'actual_qty']) ?? 0)), 0) / actualTotal, bias: scored.reduce((sum, row) => sum + ((agentNumber(row, keys) ?? 0) - (agentNumber(row, ['act', 'actual', 'actual_qty']) ?? 0)), 0) / actualTotal };
    if (actualTotal === 0) reason = 'ZERO_ACTUAL';
    const dataAsOf = rows.map((row) => agentString(row, ['data_as_of', 'snapshot_date', 'updated_at'])).find(Boolean) ?? null;
    const rowFy = agentValue(rows[0], ['fy', 'fiscal_year']);
    return { data: { modelBase, fy: fy ?? (typeof rowFy === 'string' || typeof rowFy === 'number' ? rowFy : null), observedRows: scored.length, salesOl: metric(['sales_ol', 'sales_ol_qty', 'ol_sales']), scmOl: metric(['scm_ol', 'scm_ol_qty', 'ol_scm']), dataAsOf, reason }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'OL 정확도 조회에 실패했습니다.' };
  }
}

async function allBridgeRows(table: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('bridge').from(table).select('*');
  return { rows: (data ?? []) as Row[], error };
}

export async function getBomRequirement(modelBase: string): Promise<ScmResult<BomRequirement>> {
  if (!modelBase.trim()) return { data: null, error: 'MODEL_BASE_REQUIRED' };
  try {
    const [mcCap, capOption, bom, optionModel, sccConfig] = await Promise.all(['bridge_mc_cap', 'bridge_cap_option', 'bridge_bom', 'bridge_option_model', 'bridge_scc_config'].map(allBridgeRows));
    const failed = [mcCap, capOption, bom, optionModel, sccConfig].find((result) => result.error);
    if (failed?.error) return { data: null, error: failed.error.message };
    const caps = mcCap.rows.filter((row) => agentString(row, ['model_base', 'model']) === modelBase).map((row) => agentString(row, ['cap_code', 'cap_item_code', 'cap'])).filter((value): value is string => Boolean(value));
    if (caps.length === 0) return { data: null, error: 'MODEL_NOT_FOUND' };
    const capSet = new Set(caps);
    const links = capOption.rows.filter((row) => capSet.has(agentString(row, ['cap_code', 'cap_item_code', 'cap']) ?? ''));
    const optionsByCap = new Map<string, BomRequirement['caps'][number]['options']>();
    for (const link of links) {
      const capCode = agentString(link, ['cap_code', 'cap_item_code', 'cap'])!;
      const optionCode = agentString(link, ['option_code', 'option_item_code', 'option'])!;
      const modelOption = optionModel.rows.find((row) => agentString(row, ['model_base', 'model']) === modelBase && agentString(row, ['option_code', 'option_item_code', 'option']) === optionCode);
      const config = sccConfig.rows.find((row) => agentString(row, ['option_code', 'option_item_code', 'option']) === optionCode);
      const components = bom.rows.filter((row) => (agentString(row, ['option_code', 'option_item_code', 'option']) === optionCode || agentString(row, ['cap_code', 'cap_item_code', 'cap']) === capCode)).map((row) => ({ itemCode: agentString(row, ['item_code', 'component_item_code', 'component_code']) ?? 'UNKNOWN', quantity: agentNumber(row, ['quantity', 'qty', 'requirement_qty']) }));
      const option = { optionCode, role: agentString(link, ['role', 'option_role']), scc: agentString(config ?? link, ['scc', 'scc_code']), label: agentString(config ?? link, ['label', 'scc_label']), common: agentString(modelOption ?? {}, ['common', 'common_flag'])?.toUpperCase() === 'COMMON' || modelOption?.common === true, components };
      const existing = optionsByCap.get(capCode) ?? [];
      if (!existing.some((candidate) => candidate.optionCode === optionCode)) existing.push(option);
      optionsByCap.set(capCode, existing);
    }
    return { data: { modelBase, caps: caps.map((capCode) => ({ capCode, options: optionsByCap.get(capCode) ?? [] })), dataAsOf: null, reason: null }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'BOM 소요량 조회에 실패했습니다.' };
  }
}

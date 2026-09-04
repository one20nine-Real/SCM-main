export type LeadtimeGap = {
  supplier: string;
  country: string;
  masterLeadTime: number | null;
  sampleCount: number;
  actualAverage: number | null;
  p80: number | null;
  gap: number | null;
};

export type StockoutRisk = {
  itemId: string;
  itemName: string;
  supplier: string;
  currentStock: number | null;
  inboundQty: number | null;
  availableQty: number | null;
  dailyUsageAvg: number | null;
  plannedLeadTime: number | null;
  stockoutDays: number | null;
  stockoutDate: string | null;
  riskStatus: 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE' | 'UNKNOWN';
  reason: string | null;
  stockoutPeriod?: string | null;
  monthsOfSupply?: number | null;
};

export type LeadtimePolicy = {
  itemId: string; itemName: string; supplierId: string; supplierName: string; country: string;
  samples: number | null; mean: number | null; p50: number | null; p80: number | null; p90: number | null;
  itemConfirmed: number | null; supplierConfirmed: number | null; effective: number | null;
  source: string; effectiveFrom: string | null; changedBy: string | null; reason: string | null;
};

export type InventoryProjection = {
  itemId: string; itemName: string; supplierId: string; period: string;
  beginningInventory: number | null; scheduledReceipt: number | null; confirmedSalesOrder: number | null;
  softAllocation: number | null; forecastDemand: number | null; endingInventory: number | null;
  stockoutPeriod: string | null; daysOfSupply: number | null; monthsOfSupply: number | null;
  riskStatus: 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE'; reasonCode: string | null;
};

export type StockoutKpi = {
  items: number;
  critical: number;
  warning?: number;
  safe: number;
  unknown: number;
  within30Days: number;
  averageStockoutDays: number | null;
};

export type DemandType = 'SMOOTH' | 'INTERMITTENT' | 'ERRATIC' | 'LUMPY';
export type DemandProfile = {
  itemId: string; itemName: string; periods: number; nonzeroPeriods: number;
  adi: number | null; cv: number | null; cvSquared: number | null; zeroDemandRate: number | null;
  trend: number | null; recentChangeRate: number | null; peakPeriod: string | null;
  demandType: DemandType | null; seasonality: string | null; reasonCode: string | null; stability: string | null;
};
export type DemandProfileKpi = { totalItems: number; smooth: number; intermittent: number; erratic: number; lumpy: number; crostonNeeded: number; calculationUnavailable: number };
export type ModelConfig = { modelId: string; modelName: string; family: string; engine: string; version: string; enabled: boolean; applicableDemandType: string[]; parameters: Record<string, unknown>; description: string | null };
export type ForecastRun = { runId: string; status: 'RUNNING' | 'SUCCESS' | 'FAILED'; granularity: string; trainStart: string | null; trainEnd: string | null; horizon: number; nModels: number; nItems: number; nRows: number; dataSnapshotAt: string; isStale: boolean; startedAt: string; finishedAt: string | null; triggeredEmail: string | null; message: string | null };
export type ModelPerformance = { backtestRunId: string; forecastRunId: string; modelId: string; modelVersion: string; itemId: string; nPeriods: number; wape: number | null; mape: number | null; bias: number | null; rmse: number | null; mae: number | null; baselineImprovement: number | null; rank: number | null; calculationStatus: string; reasonCode: string | null };
export type ForecastComparison = { runId: string; modelId: string; itemId: string; period: string; modelVersion: string; predictedQty: number | null; p50: number | null; p80: number | null; p90: number | null; sigma: number | null; basis: string; actualQty: number | null };
export type SafetyStock = { itemId: string; itemName: string; itemGrade: string | null; serviceLevel: number | null; zValue: number | null; expectedDemand: number | null; effectiveLeadtime: number | null; sigmaD: number | null; sigmaL: number | null; sigmaDlt: number | null; safetyStock: number | null; reasonCode: string | null; forecastModelId: string | null; forecastModelVersion: string | null };
export type PurchaseRecommendation = { itemId: string; itemName: string; itemGrade: string | null; forecastQty: number | null; confirmedOrderQty: number | null; demandBasisQty: number | null; availableInventory: number | null; scheduledReceipt: number | null; safetyStock: number | null; effectiveLeadtime: number | null; stockoutDate: string | null; safetyBufferDays: number | null; requiredQty: number | null; moq: number | null; packSize: number | null; recommendedQty: number | null; recommendedOrderDate: string | null; isImmediate: boolean; isOverdue: boolean; riskStatus: StockoutRisk['riskStatus']; calculationStatus: 'CALCULATED' | 'NO_ORDER_REQUIRED' | 'CALCULATION_UNAVAILABLE'; reasonCode: string | null; forecastRunId: string | null; modelVersion: string | null; calculationTrace: Record<string, unknown> };

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function numberValue(row: Record<string, unknown> | unknown, keys?: string[]) {
  const raw = keys ? value(row as Record<string, unknown>, keys) : row;
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLeadtimeGap(row: Record<string, unknown>): LeadtimeGap {
  return {
    supplier: String(value(row, ['supplier_name', 'supplier', '법인', '공급처', '공급업체명']) ?? '미정'),
    country: String(value(row, ['country', '국가']) ?? '미정'),
    masterLeadTime: numberValue(row, ['std_lead_time', 'master_lt', 'master_lead_time', 'planned_lead_time', '표준리드타임', '표준리드타임(일)', '마스터값']),
    sampleCount: numberValue(row, ['n_samples', 'sample_count', 'samples', '표본수']) ?? 0,
    actualAverage: numberValue(row, ['mean_days', 'actual_avg', 'actual_average', 'avg_lead_time', '실적평균']),
    p80: numberValue(row, ['p80_days', 'p80', 'P80']),
    gap: numberValue(row, ['gap_days', 'gap', 'leadtime_gap', '격차']),
  };
}

export function normalizeStockoutRisk(row: Record<string, unknown>): StockoutRisk {
  const status = String(value(row, ['risk_status', 'status', '위험상태']) ?? 'UNKNOWN').toUpperCase();
  const reasonValue = value(row, ['reason', '사유']);
  const reason = reasonValue ? String(reasonValue) : null;

  return {
    itemId: String(value(row, ['item_id', 'item_code', '품목코드']) ?? '미정'),
    itemName: String(value(row, ['item_name', '품목명']) ?? '미정'),
    supplier: String(value(row, ['supplier_name', 'supplier_id', 'supplier', '법인', '공급처']) ?? '미정'),
    currentStock: numberValue(row, ['current_stock', '재고', '현재고']),
    inboundQty: numberValue(row, ['inbound_qty', '입고예정', '입고예정수량']),
    availableQty: numberValue(row, ['available_qty', '가용재고']),
    dailyUsageAvg: numberValue(row, ['daily_usage_avg', '일평균사용량', '일평균 사용량']),
    plannedLeadTime: numberValue(row, ['planned_lead_time', '계획리드타임', '계획 리드타임']),
    stockoutDays: numberValue(row, ['stockout_days', '소진예상일수', '소진 예상일']),
    stockoutDate: value(row, ['stockout_date', '소진예상일', '소진 예상일자']) as string | null,
    riskStatus: status === 'SAFE' || status === 'WARNING' || status === 'CRITICAL' || status === 'CALCULATION_UNAVAILABLE' || status === 'UNKNOWN' ? status : 'CALCULATION_UNAVAILABLE',
    reason,
    stockoutPeriod: value(row, ['stockout_period', 'stockoutPeriod']) as string | null,
    monthsOfSupply: numberValue(row, ['months_of_supply', 'monthsOfSupply']),
  };
}

export function normalizeLeadtimePolicy(row: Record<string, unknown>): LeadtimePolicy {
  return { itemId: String(value(row, ['item_id']) ?? '미정'), itemName: String(value(row, ['item_name']) ?? '미정'), supplierId: String(value(row, ['supplier_id']) ?? '미정'), supplierName: String(value(row, ['supplier_name']) ?? '미정'), country: String(value(row, ['country']) ?? '미정'), samples: numberValue(row, ['n_samples']), mean: numberValue(row, ['mean_days']), p50: numberValue(row, ['p50_days']), p80: numberValue(row, ['p80_days']), p90: numberValue(row, ['p90_days']), itemConfirmed: numberValue(row, ['item_confirmed_lead_time']), supplierConfirmed: numberValue(row, ['supplier_confirmed_lead_time']), effective: numberValue(row, ['effective_lead_time']), source: String(value(row, ['effective_source']) ?? 'UNAVAILABLE'), effectiveFrom: value(row, ['effective_from']) as string | null, changedBy: value(row, ['changed_by']) as string | null, reason: value(row, ['confirmed_reason']) as string | null };
}

export function normalizeInventoryProjection(row: Record<string, unknown>): InventoryProjection {
  const status = String(value(row, ['risk_status']) ?? 'CALCULATION_UNAVAILABLE').toUpperCase();
  return { itemId: String(value(row, ['item_id']) ?? '미정'), itemName: String(value(row, ['item_name']) ?? '미정'), supplierId: String(value(row, ['supplier_id']) ?? '미정'), period: String(value(row, ['period']) ?? ''), beginningInventory: numberValue(row, ['beginning_inventory']), scheduledReceipt: numberValue(row, ['scheduled_receipts']), confirmedSalesOrder: numberValue(row, ['confirmed_sales_order']), softAllocation: numberValue(row, ['soft_allocation']), forecastDemand: numberValue(row, ['forecast_demand']), endingInventory: numberValue(row, ['ending_projected_inventory']), stockoutPeriod: value(row, ['stockout_period']) as string | null, daysOfSupply: numberValue(row, ['days_of_supply']), monthsOfSupply: numberValue(row, ['months_of_supply']), riskStatus: status === 'SAFE' || status === 'WARNING' || status === 'CRITICAL' ? status : 'CALCULATION_UNAVAILABLE', reasonCode: value(row, ['reason_code']) as string | null };
}

export function normalizeStockoutKpi(row: Record<string, unknown>): StockoutKpi {
  return {
    items: numberValue(row, ['n_items', 'items', '전체품목']) ?? 0,
    critical: numberValue(row, ['n_critical', 'critical', '위험품목']) ?? 0,
    safe: numberValue(row, ['n_safe', 'safe', '안전품목']) ?? 0,
    unknown: numberValue(row, ['n_unknown', 'unknown', '판정불가']) ?? 0,
    within30Days: numberValue(row, ['n_within_30d', 'within30Days', '30일 이내']) ?? 0,
    averageStockoutDays: numberValue(row, ['avg_stockout_days', 'averageStockoutDays', '평균소진일수']),
  };
}

export function normalizeDemandProfile(row: Record<string, unknown>): DemandProfile {
  const rawType = String(value(row, ['demand_type', 'demandType', '수요유형']) ?? '');
  const demandType: DemandType | null = ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'].includes(rawType) ? rawType as DemandType : null;
  return { itemId: String(value(row, ['item_id', 'sku', '품목코드']) ?? '미정'), itemName: String(value(row, ['item_name', '품목명']) ?? '미정'), periods: numberValue(row, ['n_periods', 'periods', '기간수']) ?? 0, nonzeroPeriods: numberValue(row, ['n_nonzero_periods', 'nonzero_periods', '수요발생기간수']) ?? 0, adi: numberValue(row, ['adi', 'ADI']), cv: numberValue(row, ['cv', 'CV']), cvSquared: numberValue(row, ['cv_squared', 'cv2', 'CV²']), zeroDemandRate: numberValue(row, ['zero_demand_rate', 'zeroDemandRate', '무수요비율']), trend: numberValue(row, ['trend', 'trend_per_period', '추세']), recentChangeRate: numberValue(row, ['recent_change_rate', 'recentChangeRate', '최근변화율']), peakPeriod: value(row, ['peak_period', 'peakPeriod', '최대수요기간']) as string | null, demandType, seasonality: value(row, ['seasonality', '계절성']) as string | null, reasonCode: value(row, ['reason_code', 'reasonCode', '사유코드']) as string | null, stability: value(row, ['stability', '안정성']) as string | null };
}

export function normalizeDemandProfileKpi(row: Record<string, unknown>): DemandProfileKpi { return { totalItems: numberValue(row, ['total_items', 'totalItems']) ?? 0, smooth: numberValue(row, ['n_smooth', 'smooth']) ?? 0, intermittent: numberValue(row, ['n_intermittent', 'intermittent']) ?? 0, erratic: numberValue(row, ['n_erratic', 'erratic']) ?? 0, lumpy: numberValue(row, ['n_lumpy', 'lumpy']) ?? 0, crostonNeeded: numberValue(row, ['n_croston_needed', 'crostonNeeded']) ?? 0, calculationUnavailable: numberValue(row, ['n_calculation_unavailable', 'calculationUnavailable']) ?? 0 }; }

export function normalizeModelConfig(row: Record<string, unknown>): ModelConfig { return { modelId: String(row.model_id ?? ''), modelName: String(row.model_name ?? ''), family: String(row.family ?? ''), engine: String(row.engine ?? ''), version: String(row.version ?? ''), enabled: row.enabled === true, applicableDemandType: Array.isArray(row.applicable_demand_type) ? row.applicable_demand_type.map(String) : [], parameters: (row.parameters as Record<string, unknown> | null) ?? {}, description: row.description as string | null }; }
export function normalizeForecastRun(row: Record<string, unknown>): ForecastRun { return { runId: String(row.run_id ?? ''), status: String(row.status ?? 'FAILED') as ForecastRun['status'], granularity: String(row.granularity ?? ''), trainStart: row.train_start as string | null, trainEnd: row.train_end as string | null, horizon: numberValue(row.horizon) ?? 0, nModels: numberValue(row.n_models) ?? 0, nItems: numberValue(row.n_items) ?? 0, nRows: numberValue(row.n_rows) ?? 0, dataSnapshotAt: String(row.data_snapshot_at ?? ''), isStale: row.is_stale === true, startedAt: String(row.started_at ?? ''), finishedAt: row.finished_at as string | null, triggeredEmail: row.triggered_email as string | null, message: row.message as string | null }; }
export function normalizeModelPerformance(row: Record<string, unknown>): ModelPerformance { return { backtestRunId: String(row.backtest_run_id ?? ''), forecastRunId: String(row.forecast_run_id ?? ''), modelId: String(row.model_id ?? ''), modelVersion: String(row.model_version ?? ''), itemId: String(row.item_id ?? ''), nPeriods: numberValue(row.n_periods) ?? 0, wape: numberValue(row.wape), mape: numberValue(row.mape), bias: numberValue(row.bias), rmse: numberValue(row.rmse), mae: numberValue(row.mae), baselineImprovement: numberValue(row.baseline_improvement), rank: numberValue(row.rank), calculationStatus: String(row.calculation_status ?? ''), reasonCode: row.reason_code as string | null }; }
export function normalizeForecastComparison(row: Record<string, unknown>): ForecastComparison { return { runId: String(row.run_id ?? ''), modelId: String(row.model_id ?? ''), itemId: String(row.item_id ?? ''), period: String(row.period ?? ''), modelVersion: String(row.model_version ?? ''), predictedQty: numberValue(row.predicted_qty), p50: numberValue(row.p50), p80: numberValue(row.p80), p90: numberValue(row.p90), sigma: numberValue(row.sigma), basis: String(row.basis ?? ''), actualQty: numberValue(row.actual_qty) }; }
export function normalizeSafetyStock(row: Record<string, unknown>): SafetyStock { return { itemId: String(value(row, ['item_id']) ?? '미정'), itemName: String(value(row, ['item_name']) ?? '미정'), itemGrade: value(row, ['item_grade']) as string | null, serviceLevel: numberValue(row, ['service_level']), zValue: numberValue(row, ['z_value']), expectedDemand: numberValue(row, ['expected_demand']), effectiveLeadtime: numberValue(row, ['effective_lead_time']), sigmaD: numberValue(row, ['sigma_d']), sigmaL: numberValue(row, ['sigma_l']), sigmaDlt: numberValue(row, ['sigma_dlt']), safetyStock: numberValue(row, ['safety_stock']), reasonCode: value(row, ['reason_code']) as string | null, forecastModelId: value(row, ['forecast_model_id']) as string | null, forecastModelVersion: value(row, ['forecast_model_version']) as string | null }; }
export function normalizePurchaseRecommendation(row: Record<string, unknown>): PurchaseRecommendation { const status = String(value(row, ['risk_status']) ?? 'CALCULATION_UNAVAILABLE').toUpperCase(); const calculationStatus = String(value(row, ['calculation_status']) ?? 'CALCULATION_UNAVAILABLE').toUpperCase(); return { itemId: String(value(row, ['item_id']) ?? '미정'), itemName: String(value(row, ['item_name']) ?? '미정'), itemGrade: value(row, ['item_grade']) as string | null, forecastQty: numberValue(row, ['forecast_qty']), confirmedOrderQty: numberValue(row, ['confirmed_order_qty']), demandBasisQty: numberValue(row, ['demand_basis_qty']), availableInventory: numberValue(row, ['available_inventory']), scheduledReceipt: numberValue(row, ['scheduled_receipt']), safetyStock: numberValue(row, ['safety_stock']), effectiveLeadtime: numberValue(row, ['effective_leadtime']), stockoutDate: value(row, ['stockout_date']) as string | null, safetyBufferDays: numberValue(row, ['safety_buffer_days']), requiredQty: numberValue(row, ['required_qty']), moq: numberValue(row, ['moq']), packSize: numberValue(row, ['pack_size']), recommendedQty: numberValue(row, ['recommended_qty']), recommendedOrderDate: value(row, ['recommended_order_date']) as string | null, isImmediate: row.is_immediate === true, isOverdue: row.is_overdue === true, riskStatus: status === 'SAFE' || status === 'WARNING' || status === 'CRITICAL' || status === 'CALCULATION_UNAVAILABLE' ? status : 'CALCULATION_UNAVAILABLE', calculationStatus: calculationStatus === 'CALCULATED' || calculationStatus === 'NO_ORDER_REQUIRED' ? calculationStatus : 'CALCULATION_UNAVAILABLE', reasonCode: value(row, ['reason_code']) as string | null, forecastRunId: value(row, ['forecast_run_id']) as string | null, modelVersion: value(row, ['model_version']) as string | null, calculationTrace: (row.calculation_trace as Record<string, unknown> | null) ?? {} }; }

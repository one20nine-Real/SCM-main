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
  riskStatus: 'SAFE' | 'CRITICAL' | 'UNKNOWN';
  reason: 'NO_USAGE' | 'NO_LEADTIME' | null;
};

export type StockoutKpi = {
  items: number;
  critical: number;
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
  const reason = reasonValue === 'NO_USAGE' || reasonValue === 'NO_LEADTIME' ? reasonValue : null;

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
    riskStatus: status === 'SAFE' || status === 'CRITICAL' ? status : 'UNKNOWN',
    reason,
  };
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

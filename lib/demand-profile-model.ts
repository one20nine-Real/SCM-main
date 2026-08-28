export type DemandType = 'SMOOTH' | 'INTERMITTENT' | 'ERRATIC' | 'LUMPY';
export type DemandProfile = {
  itemId: string;
  itemName: string;
  periods: number;
  nonzeroPeriods: number;
  adi: number | null;
  cv: number | null;
  cvSquared: number | null;
  zeroDemandRate: number | null;
  trend: number | null;
  recentChangeRate: number | null;
  peakPeriod: string | null;
  demandType: DemandType | null;
  seasonality: string | null;
  reasonCode: string | null;
  stability: string | null;
};

function value(row: Record<string, unknown>, keys: string[]) { for (const key of keys) if (row[key] !== null && row[key] !== undefined && row[key] !== '') return row[key]; return null; }
function numberValue(row: Record<string, unknown>, keys: string[]) { const raw = value(row, keys); if (raw === null) return null; const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : null; }

export function normalizeDemandProfile(row: Record<string, unknown>): DemandProfile {
  const rawType = String(value(row, ['demand_type', 'demandType', '수요유형']) ?? '');
  const demandType: DemandType | null = ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'].includes(rawType) ? rawType as DemandType : null;
  return {
    itemId: String(value(row, ['item_id', 'sku', '품목코드']) ?? '미정'),
    itemName: String(value(row, ['item_name', '품목명']) ?? '미정'),
    periods: numberValue(row, ['n_periods', 'periods', '기간수']) ?? 0,
    nonzeroPeriods: numberValue(row, ['n_nonzero_periods', 'nonzero_periods', '수요발생기간수']) ?? 0,
    adi: numberValue(row, ['adi', 'ADI']), cv: numberValue(row, ['cv', 'CV']), cvSquared: numberValue(row, ['cv_squared', 'cv2', 'CV²']),
    zeroDemandRate: numberValue(row, ['zero_demand_rate', 'zeroDemandRate', '무수요비율']), trend: numberValue(row, ['trend', 'trend_per_period', '추세']), recentChangeRate: numberValue(row, ['recent_change_rate', 'recentChangeRate', '최근변화율']),
    peakPeriod: value(row, ['peak_period', 'peakPeriod', '최대수요기간']) as string | null, demandType, seasonality: value(row, ['seasonality', '계절성']) as string | null, reasonCode: value(row, ['reason_code', 'reasonCode', '사유코드']) as string | null, stability: value(row, ['stability', '안정성']) as string | null,
  };
}

export type DemandProfileFilters = { demandType: DemandType | 'ALL'; availability: 'all' | 'available' | 'unavailable'; sku: string };
export function filterDemandProfiles(rows: DemandProfile[], filters: DemandProfileFilters) {
  const sku = filters.sku.trim().toLowerCase();
  return rows.filter((row) => (filters.demandType === 'ALL' || row.demandType === filters.demandType) && (filters.availability === 'all' || (filters.availability === 'available' ? row.demandType !== null : row.demandType === null)) && (!sku || row.itemId.toLowerCase().includes(sku) || row.itemName.toLowerCase().includes(sku)));
}

export type DemandProfileKpi = { totalItems: number; smooth: number; intermittent: number; erratic: number; lumpy: number; crostonNeeded: number; calculationUnavailable: number };
export function normalizeDemandProfileKpi(row: Record<string, unknown>): DemandProfileKpi { return { totalItems: numberValue(row, ['total_items', 'totalItems']) ?? 0, smooth: numberValue(row, ['n_smooth', 'smooth']) ?? 0, intermittent: numberValue(row, ['n_intermittent', 'intermittent']) ?? 0, erratic: numberValue(row, ['n_erratic', 'erratic']) ?? 0, lumpy: numberValue(row, ['n_lumpy', 'lumpy']) ?? 0, crostonNeeded: numberValue(row, ['n_croston_needed', 'crostonNeeded']) ?? 0, calculationUnavailable: numberValue(row, ['n_calculation_unavailable', 'calculationUnavailable']) ?? 0 }; }

export type ForecastSettings = {
  dataStart: string | null;
  dataEnd: string | null;
  trainStart: string | null;
  trainEnd: string | null;
  testStart: string | null;
  testEnd: string | null;
  trainRowCount: number;
  testRowCount: number;
  trainWindowOk: boolean;
  testWindowOk: boolean;
  windowsDisjoint: boolean;
  granularity: 'day' | 'week' | 'month';
  serviceLevel: number | null;
  reviewPeriodDays: number | null;
  safetyBufferDays: number | null;
  policySettings: Record<string, unknown>;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeForecastSettings(row: Record<string, unknown>): ForecastSettings {
  const granularity = String(row.granularity ?? 'month');
  return {
    dataStart: (row.data_start as string | null | undefined) ?? null,
    dataEnd: (row.data_end as string | null | undefined) ?? null,
    trainStart: (row.train_start as string | null | undefined) ?? null,
    trainEnd: (row.train_end as string | null | undefined) ?? null,
    testStart: (row.test_start as string | null | undefined) ?? null,
    testEnd: (row.test_end as string | null | undefined) ?? null,
    trainRowCount: numberValue(row.train_row_count),
    testRowCount: numberValue(row.test_row_count),
    trainWindowOk: row.train_window_ok === true,
    testWindowOk: row.test_window_ok === true,
    windowsDisjoint: row.windows_disjoint === true,
    granularity: granularity === 'day' || granularity === 'week' ? granularity : 'month',
    serviceLevel: row.service_level === null || row.service_level === undefined ? null : numberValue(row.service_level),
    reviewPeriodDays: row.review_period_days === null || row.review_period_days === undefined ? null : numberValue(row.review_period_days),
    safetyBufferDays: row.safety_buffer_days === null || row.safety_buffer_days === undefined ? null : numberValue(row.safety_buffer_days),
    policySettings: (row.policy_settings as Record<string, unknown> | null) ?? {},
  };
}

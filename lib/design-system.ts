export type StatusCode = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';
export type ReasonCode = 'NO_USAGE' | 'NO_LEADTIME' | 'NO_DATA' | string;

const statusLabels: Record<StatusCode, string> = {
  SAFE: '안전', WARNING: '주의', CRITICAL: '위험', CALCULATION_UNAVAILABLE: '계산 불가',
};

export function getStatusLabel(status: StatusCode) { return statusLabels[status]; }
export function formatUnavailable(reasonCode: ReasonCode) { return `— + ${reasonCode}`; }
export function toBadgeStatus(status: string): StatusCode {
  return status === 'SAFE' || status === 'WARNING' || status === 'CRITICAL' || status === 'CALCULATION_UNAVAILABLE'
    ? status
    : 'CALCULATION_UNAVAILABLE';
}

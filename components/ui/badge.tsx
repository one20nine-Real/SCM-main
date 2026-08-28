import { getStatusLabel, type StatusCode } from '@/lib/design-system';
export type BadgeStatus = StatusCode | 'INFO';
export default function Badge({ status, children }: { status: BadgeStatus; children?: React.ReactNode }) {
  return <span className={`ui-badge ui-badge-${status.toLowerCase()}`}>{children ?? (status === 'INFO' ? '정보' : getStatusLabel(status))}</span>;
}

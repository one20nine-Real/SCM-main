import { formatUnavailable, type ReasonCode } from '@/lib/design-system';
export default function EmptyValue({ reasonCode = 'NO_DATA', label }: { reasonCode?: ReasonCode; label?: string }) {
  return <span className="ui-empty-value" title={label}>{formatUnavailable(reasonCode)}</span>;
}

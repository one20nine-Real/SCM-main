import type { ReactNode } from 'react';
import Badge, { type BadgeStatus } from './badge';
export default function KpiCard({ label, value, foot, status, icon }: { label: string; value: ReactNode; foot?: ReactNode; status?: BadgeStatus; icon?: ReactNode }) {
  return <section className="ui-kpi-card"><div className="ui-kpi-head"><span className="ui-kpi-label">{label}</span>{icon}</div><strong className="ui-kpi-value">{value}</strong>{status ? <Badge status={status} /> : foot && <span className="ui-kpi-foot">{foot}</span>}</section>;
}

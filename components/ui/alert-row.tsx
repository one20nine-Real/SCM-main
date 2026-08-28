import Badge, { type BadgeStatus } from './badge';
export default function AlertRow({ title, description, status = 'WARNING' }: { title: string; description: string; status?: BadgeStatus }) {
  return <div className="ui-alert-row"><div><strong>{title}</strong><p>{description}</p></div><Badge status={status} /></div>;
}

import type { ReactNode } from 'react';
export default function Panel({ title, description, children, className = '' }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`ui-panel ${className}`}>{title && <div className="ui-panel-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div></div>}{children}</section>;
}

import type { ReactNode } from 'react';
export default function InsightBanner({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="ui-insight-banner"><strong>{title}</strong><span>{children}</span></aside>;
}

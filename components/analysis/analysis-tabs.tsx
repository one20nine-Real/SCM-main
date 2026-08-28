'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { userMenu } from '@/lib/menu';

export default function AnalysisTabs() {
  const pathname = usePathname();
  return <nav className="analysis-tabs" aria-label="분석 화면">{userMenu.filter((item) => item.kicker === 'ANALYSIS').map((item) => <Link key={item.href} href={item.href} className={`analysis-tab ${pathname === item.href ? 'active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}</nav>;
}

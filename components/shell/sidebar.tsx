'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, Gauge, Settings2 } from 'lucide-react';
import { adminMenu, userMenu } from '@/lib/menu';

const icons = [Gauge, BarChart3, Boxes];

export default function Sidebar() {
  const pathname = usePathname();
  return <aside className="app-sidebar">
    <Link className="shell-brand" href="/dashboard"><span className="shell-brand-mark">OP</span><span><strong>월간 발주계획</strong><small>Procurement Planning</small></span></Link>
    <div className="shell-nav-group"><span className="shell-nav-label">USER</span><nav className="shell-nav" aria-label="사용자 메뉴">{userMenu.map((item, index) => { const Icon = icons[index] ?? BarChart3; return <Link key={item.href} href={item.href} className={`shell-nav-link ${pathname === item.href ? 'active' : ''}`}><Icon size={16} aria-hidden="true" /><span>{item.label}</span></Link>; })}</nav></div>
    <div className="shell-nav-group"><span className="shell-nav-label">ADMIN</span><nav className="shell-nav" aria-label="관리자 메뉴">{adminMenu.map((item) => <Link key={item.href} href={item.href} className={`shell-nav-link ${pathname === item.href ? 'active' : ''}`}><Settings2 size={16} aria-hidden="true" /><span>{item.label}</span></Link>)}</nav></div>
    <div className="shell-sidebar-foot"><b>2026년 09월 발주계획</b><br />SCM CONTROL CENTER</div>
  </aside>;
}

import { Bell } from 'lucide-react';
import Button from '@/components/ui/button';
import { logoutAction } from '@/app/(auth)/login/actions';
export default function Topbar({ title = 'SCM Control Center' }: { title?: string }) {
  return <header className="app-topbar"><div><span className="eyebrow">MONTHLY PROCUREMENT CONTROL</span><h1>{title}</h1></div><div className="topbar-actions"><span className="connection-badge">SUPABASE LIVE</span><span className="topbar-period">기준월 <b>2026.09</b></span><button className="icon-button" aria-label="알림"><Bell size={17} /></button><form action={logoutAction}><Button>로그아웃</Button></form></div></header>;
}

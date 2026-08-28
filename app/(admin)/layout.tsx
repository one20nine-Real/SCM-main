import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth';
import AppShell from '@/components/shell/app-shell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AppShell title="관리자 설정">{children}</AppShell>;
}

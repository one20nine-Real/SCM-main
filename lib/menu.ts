export type MenuItem = { href: string; label: string; kicker?: string };

export const userMenu: MenuItem[] = [
  { href: '/dashboard', label: '전체 현황', kicker: 'OVERVIEW' },
  { href: '/analysis/leadtime', label: '리드타임 격차', kicker: 'ANALYSIS' },
  { href: '/analysis/stockout', label: '재고 소진 위험', kicker: 'ANALYSIS' },
];

export const adminMenu: MenuItem[] = [{ href: '/admin', label: '관리자 설정', kicker: 'ADMIN' }];
export const authMenu: MenuItem[] = [{ href: '/login', label: '로그인' }];

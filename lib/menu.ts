export type MenuItem = { href: string; label: string; kicker?: string };

export const userMenu: MenuItem[] = [
  { href: '/dashboard', label: '전체 현황', kicker: 'OVERVIEW' },
  { href: '/analysis/leadtime', label: '리드타임 격차', kicker: 'ANALYSIS' },
  { href: '/analysis/stockout', label: '재고 소진 위험', kicker: 'ANALYSIS' },
  { href: '/analysis/demand-profile', label: 'SKU 수요 프로파일', kicker: 'ANALYSIS' },
  { href: '/analysis/model-comparison', label: 'Model Comparison', kicker: 'ANALYSIS' },
];

export const adminMenu: MenuItem[] = [{ href: '/admin', label: '관리자 설정', kicker: 'ADMIN' }, { href: '/admin/users', label: '사용자 관리', kicker: 'ADMIN' }, { href: '/admin/forecast-settings', label: 'Forecast 설정', kicker: 'ADMIN' }, { href: '/admin/forecast-models', label: 'Forecast Models', kicker: 'ADMIN' }, { href: '/admin/forecast-runs', label: 'Forecast Runs', kicker: 'ADMIN' }, { href: '/admin/forecast-runs/champions', label: 'Champion Models', kicker: 'ADMIN' }, { href: '/admin/data-management', label: 'Data Management', kicker: 'ADMIN' }, { href: '/admin/data-management/upload', label: 'File Upload', kicker: 'ADMIN' }, { href: '/admin/data-management/history', label: 'Import History', kicker: 'ADMIN' }];
export const authMenu: MenuItem[] = [{ href: '/login', label: '로그인' }];

import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import EmptyValue from '@/components/ui/empty-value';
import { requireAdmin } from '@/lib/auth';
import UserRowForm from './user-row-form';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const { user, supabase } = await requireAdmin();
  const { data, error } = await supabase.schema('core').from('app_user').select('user_id,email,name,department,role,active').order('created_at', { ascending: true });
  return <><PageHeader eyebrow="ADMIN / USERS" title="사용자 관리" description="ADMIN 권한으로 사용자 역할과 활성 상태를 관리합니다." /><Panel title="등록 사용자" description="자기 자신의 role과 active 상태는 변경할 수 없습니다.">{error ? <p className="text-danger">사용자 목록을 불러오지 못했습니다: {error.message}</p> : data && data.length > 0 ? <div className="admin-user-list">{data.map((row) => <UserRowForm key={row.user_id} row={row as never} self={row.user_id === user.id} />)}</div> : <EmptyValue reasonCode="NO_DATA" label="등록된 사용자가 없습니다." />}</Panel></>;
}

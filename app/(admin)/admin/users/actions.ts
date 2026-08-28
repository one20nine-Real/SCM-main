'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export type UserMutationState = { error?: string; success?: string };

export async function updateUserAction(_state: UserMutationState, formData: FormData): Promise<UserMutationState> {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!userId || (role !== 'ADMIN' && role !== 'USER')) return { error: '잘못된 사용자 변경 요청입니다.' };
  const { error } = await supabase.schema('core').rpc('admin_update_user', { target_user_id: userId, next_role: role, next_active: active });
  if (error) return { error: error.message.includes('SELF_ACCOUNT_CHANGE_FORBIDDEN') ? '자신의 관리자 권한과 활성 상태는 변경할 수 없습니다.' : '사용자 변경에 실패했습니다.' };
  revalidatePath('/admin/users');
  return { success: '변경사항을 저장했습니다.' };
}

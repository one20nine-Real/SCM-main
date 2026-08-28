'use client';

import { useActionState } from 'react';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { updateUserAction, type UserMutationState } from './actions';

type Row = { user_id: string; email: string; name: string; department: string; role: 'ADMIN' | 'USER'; active: boolean };
const initialState: UserMutationState = {};

export default function UserRowForm({ row, self }: { row: Row; self: boolean }) {
  const [state, action, pending] = useActionState(updateUserAction, initialState);
  return <form className="admin-user-row" action={action}><div><strong>{row.name || row.email}</strong><span>{row.email} · {row.department || '부서 미지정'}</span></div><Badge status={row.active ? 'SAFE' : 'INFO'}>{row.active ? '활성' : '비활성'}</Badge><select name="role" defaultValue={row.role} disabled={self}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select><select name="active" defaultValue={String(row.active)} disabled={self}><option value="true">활성</option><option value="false">비활성</option></select><input type="hidden" name="user_id" value={row.user_id} /><Button variant="primary" type="submit" disabled={self || pending}>{self ? '내 계정' : pending ? '저장 중…' : '저장'}</Button>{state.error && <span className="text-danger" role="alert">{state.error}</span>}{state.success && <span className="text-good" role="status">{state.success}</span>}</form>;
}

'use client';

import { useActionState } from 'react';
import Panel from '@/components/ui/panel';
import Button from '@/components/ui/button';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = {};

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return <Panel title="월간 발주계획 로그인" description="등록된 Supabase Auth 계정으로 로그인하세요."><form className="auth-form" action={action}><input type="hidden" name="next" value={next ?? '/dashboard'} /><label>이메일<input className="form-input" name="email" type="email" autoComplete="email" required /></label><label>비밀번호<input className="form-input" name="password" type="password" autoComplete="current-password" required /></label>{state.error && <p className="text-danger" role="alert">{state.error}</p>}<Button variant="primary" type="submit" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</Button></form></Panel>;
}

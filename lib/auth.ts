import { forbidden, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AppRole = 'ADMIN' | 'USER';
export type AppUser = { user_id: string; email: string; name: string; department: string; role: AppRole; active: boolean };

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/dashboard')}`);
  const { data: profile, error } = await supabase.schema('core').from('app_user').select('*').eq('user_id', user.id).maybeSingle();
  if (error || !profile || !profile.active) forbidden();
  return { user, profile: profile as AppUser, supabase };
}

export async function getRole(): Promise<AppRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.schema('core').from('app_user').select('role, active').eq('user_id', user.id).maybeSingle();
  return data?.active && (data.role === 'ADMIN' || data.role === 'USER') ? data.role : null;
}

export async function requireAdmin() {
  const result = await requireUser();
  if (result.profile.role !== 'ADMIN') forbidden();
  return result;
}

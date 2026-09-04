import { NextResponse } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json({ configured: false, connected: false, message: 'Supabase environment variables are missing.' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('analytics').from('v_stockout_kpi').select('*').limit(1);
  if (error) {
    return NextResponse.json({ configured: true, connected: false, message: `Supabase query failed: ${error.message}` }, { status: 503 });
  }

  return NextResponse.json({ configured: true, connected: true, message: 'Supabase connection is healthy.' });
}

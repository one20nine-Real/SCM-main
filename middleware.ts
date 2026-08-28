import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requireSupabaseEnv } from './lib/supabase/env';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = ['/dashboard', '/analysis', '/admin', '/workflow'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isProtected) return NextResponse.next();
  const response = NextResponse.next({ request });
  const { url, publishableKey } = requireSupabaseEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) { cookiesToSet.forEach(({ name, value, options }) => { request.cookies.set(name, value); response.cookies.set(name, value, options); }); },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/analysis/:path*', '/admin/:path*', '/workflow/:path*'] };

import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') || 'email') as EmailOtpType;
  const next = url.searchParams.get('next') || '/';
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
  const errorRedirect = (message: string) =>
    NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(message)}`, url.origin));

  if (!code && !tokenHash) return errorRedirect('missing_token');
  if (!supabaseUrl || !supabaseKey) return errorRedirect('configuration');

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(target, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type, token_hash: tokenHash! });

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return response;
}

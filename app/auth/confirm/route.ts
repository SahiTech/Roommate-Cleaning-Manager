import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') || 'email';

  if (!tokenHash) {
    return NextResponse.redirect(new URL('/?auth_error=Missing+verification+token', url.origin));
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL('/?auth_error=Authentication+configuration+is+missing', url.origin));
  }

  const client = createClient(supabaseUrl, supabaseKey);
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as 'email' });

  if (error) {
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin));
  }

  return NextResponse.redirect(new URL('/', url.origin));
}

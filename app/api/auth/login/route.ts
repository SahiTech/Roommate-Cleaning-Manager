import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PRODUCTION_APP_URL = 'https://roommate-cleaning-manager.vercel.app';

function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  return (configured || PRODUCTION_APP_URL).replace(/\/$/, '');
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      return NextResponse.json({ error: 'Authentication configuration is missing.' }, { status: 500 });
    }

    // Explicitly use the browser/implicit flow so the email link does not
    // depend on a PKCE verifier stored in a browser cookie.
    const client = createClient(url, key, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAppUrl(),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send sign-in link.' },
      { status: 500 },
    );
  }
}

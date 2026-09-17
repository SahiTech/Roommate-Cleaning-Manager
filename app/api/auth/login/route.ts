import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PRODUCTION_APP_URL = 'https://roommate-cleaning-manager.vercel.app';

function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return PRODUCTION_APP_URL;
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Authentication configuration is missing.' }, { status: 500 });
    }

    // This endpoint deliberately uses the browser-compatible implicit flow.
    // The previous server-created client could generate PKCE links without
    // having a browser-side verifier stored in cookies, causing
    // "PKCE code verifier not found" after the email was opened.
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const redirectTo = `${getAppUrl()}/auth/confirm`;

    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
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

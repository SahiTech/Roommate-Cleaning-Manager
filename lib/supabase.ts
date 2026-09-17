import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __ROOMMATE_SUPABASE__?: { url?: string; key?: string };
  }
}

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be created in the browser.');
  }

  if (!client) {
    const runtime = window.__ROOMMATE_SUPABASE__;
    const url = runtime?.url || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      runtime?.key ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase configuration is unavailable.');
    }

    client = createBrowserClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    }) as SupabaseClient;

    const auth = client.auth as typeof client.auth & { __roommateServerLoginPatched?: boolean };
    if (!auth.__roommateServerLoginPatched) {
      const original = auth.signInWithOtp.bind(auth);
      auth.signInWithOtp = (async (credentials: any, options?: any) => {
        if (credentials?.email) {
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: credentials.email }),
            });
            const body = (await response.json()) as { error?: string };
            if (!response.ok) {
              return { data: { user: null, session: null }, error: new Error(body.error || 'Unable to send the sign-in link.') } as any;
            }
            return { data: { user: null, session: null }, error: null } as any;
          } catch (error) {
            return { data: { user: null, session: null }, error: new Error(error instanceof Error ? error.message : 'Unable to send the sign-in link.') } as any;
          }
        }
        return original(credentials, options);
      }) as typeof auth.signInWithOtp;
      auth.__roommateServerLoginPatched = true;
    }
  }

  return client;
}

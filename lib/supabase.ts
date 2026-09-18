import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __ROOMMATE_SUPABASE__?: { url?: string; key?: string };
  }
}

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be created in the browser.');
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

    // Client-only authentication: no SSR cookie/PKCE verifier is involved.
    // Magic links return the session in the URL fragment, which this client
    // consumes and persists in browser storage.
    client = createClient(url, key, {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return client;
}

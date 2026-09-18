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
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }) as SupabaseClient;
  }

  return client;
}

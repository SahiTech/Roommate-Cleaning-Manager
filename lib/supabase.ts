import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabase() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be created in the browser.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase public URL or client key.');
  }

  client ??= createBrowserClient(url, key);
  return client;
}

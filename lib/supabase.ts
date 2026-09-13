import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientPromise: Promise<SupabaseClient> | undefined;

export async function supabase(): Promise<SupabaseClient> {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be created in the browser.');
  }

  if (!clientPromise) {
    clientPromise = fetch('/api/config', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.url || !data.key) {
          throw new Error(data.error || 'Supabase configuration is unavailable.');
        }
        return createBrowserClient(data.url, data.key) as SupabaseClient;
      })
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }

  return clientPromise;
}

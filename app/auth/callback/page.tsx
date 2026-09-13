'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing secure sign-in…');

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        const db = await supabase();
        if (code) {
          const { error } = await db.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data } = await db.auth.getSession();
        if (!data.session) throw new Error('The sign-in link is invalid, expired, or has already been used.');
        router.replace('/');
        router.refresh();
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to complete sign-in.');
      }
    };
    void finish();
    return () => { active = false; };
  }, [router]);

  return <main className="shell"><section className="auth-card"><div className="logo">RC</div><div className="eyebrow">ROOMMATE CLEANING MANAGER</div><h1>Signing you in…</h1><p className="muted">{message}</p></section></main>;
}

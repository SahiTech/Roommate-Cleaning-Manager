import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Roommate Cleaning Manager', description: 'Simple shared cleaning duty management for roommates', manifest: '/manifest.webmanifest' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const config = JSON.stringify({ url: supabaseUrl, key: supabaseKey }).replace(/</g, '\\u003c');

  return <html lang="en"><body>
    <script dangerouslySetInnerHTML={{ __html: `window.__ROOMMATE_SUPABASE__=${config};` }} />
    {children}
  </body></html>;
}
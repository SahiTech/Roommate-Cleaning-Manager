import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Roommate Cleaning Manager', description: 'Simple shared cleaning duty management for roommates', manifest: '/manifest.webmanifest' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
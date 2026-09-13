import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Public by design: VAPID public keys are intended to be shared with browsers.
const VAPID_PUBLIC_KEY = 'BHobROWD1Uun_TfXR0WzPOwHCYN2hty1VtMUxsE5BDrlJfwuuSzgH5gI4Mun3sNjErjkQgwZFtsVwrzC625Sub4';

export function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}

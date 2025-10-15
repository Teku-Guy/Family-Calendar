import { NextResponse } from 'next/server';
import { isGoogleConnected } from '@/lib/google';

export async function GET() {
  try {
    const connected = await isGoogleConnected();
    return NextResponse.json({ connected });
  } catch (e) {
    console.error('GET /api/google/status error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

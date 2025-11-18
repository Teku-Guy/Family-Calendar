import { NextResponse } from 'next/server';
// Temporarily using simple version until migration is applied
import { getPrimaryCalendarId } from '@/lib/events-simple';

export async function GET() {
  try {
    const calendarId = await getPrimaryCalendarId();

    if (!calendarId) {
      return NextResponse.json(
        { error: 'No primary calendar found. Please sign in to create one.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ calendarId });
  } catch (e) {
    console.error('GET /api/calendars/primary error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

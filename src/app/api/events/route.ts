import { NextResponse } from 'next/server';
import { listEvents, createEvent } from '@/lib/events';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const calendarId = url.searchParams.get('calendarId') ?? undefined;

  if (!from || !to) {
    return NextResponse.json({ error: 'from/to required' }, { status: 400 });
  }

  try {
    const events = await listEvents({ from, to, calendarId });
    return NextResponse.json({ events });
  } catch (e) {
    console.error('GET /api/events error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { calendar_id, title, location, starts_at, ends_at, all_day } = body;

    if (!calendar_id || !title || !starts_at || !ends_at) {
      return NextResponse.json(
        { error: 'calendar_id, title, starts_at, and ends_at are required' },
        { status: 400 }
      );
    }

    const event = await createEvent({
      calendar_id,
      title,
      location,
      starts_at,
      ends_at,
      all_day,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    console.error('POST /api/events error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

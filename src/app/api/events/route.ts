import { NextResponse } from 'next/server';
import { listEventsRecurring } from '@/lib/events-recurring';
import { supabaseServer } from '@/lib/supabase/server';
import { eventCreateSchema } from '@/lib/validation/events';

function bad(status: number, message: string, extra?: any) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const calendarId = url.searchParams.get('calendarId') ?? undefined;

    // Validate required parameters
    if (!from || !to) return bad(400, 'from/to required');

    // Validate date parsing
    const f = new Date(from);
    const t = new Date(to);
    if (isNaN(+f) || isNaN(+t)) {
      return bad(400, 'from/to invalid', { from, to });
    }

    // Validate date range
    if (f > t) return bad(400, 'from must be <= to');

    const events = await listEventsRecurring({
      from: f.toISOString(),
      to: t.toISOString(),
      calendarId,
    });
    return NextResponse.json({ events });
  } catch (err: any) {
    console.error('[GET /api/events] error:', err);
    // Expose details in dev only
    const dev = process.env.NODE_ENV !== 'production';
    const body: any = { error: 'events_route_failed' };
    if (dev) {
      body.details = String(err?.message || err);
      body.stack = err?.stack;
    }
    return NextResponse.json(body, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const parsed = eventCreateSchema.parse(body);

    const { error, data } = await sb
      .from('events')
      .insert(parsed)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/events error:', e);
    const msg = e?.issues
      ? e.issues.map((x: any) => x.message).join(', ')
      : String(e?.message || e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

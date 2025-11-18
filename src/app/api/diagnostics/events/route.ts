/**
 * Diagnostics endpoint for testing events API
 *
 * Tests:
 * - Date parsing and window calculation
 * - Database access and session handling
 * - Event fetching with current environment
 *
 * Usage: GET /api/diagnostics/events
 */

import { NextResponse } from 'next/server';
// Temporarily using simple version until migration is applied
import { listEvents } from '@/lib/events-simple';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  };

  try {
    // Test 1: Date calculations
    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(to.getDate() + 1);
    to.setHours(23, 59, 59, 999);

    diagnostics.dateTest = {
      now: now.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      valid: from < to,
    };

    // Test 2: Supabase session
    const sb = await supabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    diagnostics.auth = {
      hasUser: !!user,
      userId: user?.id,
      error: authError?.message,
    };

    // Test 3: Database access (calendars table)
    const { data: calendars, error: calError } = await sb
      .from('calendars')
      .select('id, name, is_primary')
      .limit(5);

    diagnostics.calendarsTest = {
      success: !calError,
      count: calendars?.length ?? 0,
      error: calError?.message,
      sample: calendars?.slice(0, 2),
    };

    // Test 4: Events fetch
    const events = await listEvents({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    diagnostics.eventsTest = {
      success: true,
      count: events.length,
      sample: events.slice(0, 2).map((e) => ({
        id: e.id,
        title: e.title,
        starts_at: e.starts_at,
      })),
    };

    diagnostics.status = 'ok';
    return NextResponse.json(diagnostics);
  } catch (err: any) {
    diagnostics.status = 'error';
    diagnostics.error = {
      message: err?.message || String(err),
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}

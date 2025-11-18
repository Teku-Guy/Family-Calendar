/**
 * Supabase Connection Diagnostic Route
 *
 * Tests that the Supabase server client is properly configured
 * and can connect to the database.
 *
 * Returns:
 * - { ok: true, rows: N } - Connection successful
 * - { ok: false, error: "..." } - Connection failed
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const sb = await supabaseServer();

    // Try to query the events table (just count, no data)
    const { data, error } = await sb
      .from('events')
      .select('id', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rows: data?.length ?? 0,
      message: 'Supabase connection successful',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message || e) },
      { status: 500 }
    );
  }
}

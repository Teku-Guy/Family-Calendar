/**
 * Events library with recurring events support (RRULE)
 *
 * This implementation handles:
 * - Regular non-recurring events
 * - Recurring event series (with rrule)
 * - Event overrides (instances with modifications)
 * - Event exclusions (exdates)
 */

import { supabaseServer } from '@/lib/supabase/server';
import {
  materializeEvents,
  type MaterializedEvent,
  type SeriesMaster,
  type EventOverride,
} from '@/lib/events/materialize';

/**
 * List events for a given time window (with recurring events support)
 */
export async function listEventsRecurring({
  from,
  to,
  calendarId,
}: {
  from: string;
  to: string;
  calendarId?: string;
}): Promise<MaterializedEvent[]> {
  const sb = await supabaseServer();
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Base query filters
  const baseFilters = (query: any) => {
    let q = query;
    if (calendarId) {
      q = q.eq('calendar_id', calendarId);
    }
    return q;
  };

  // 1. Query regular events (no rrule, no series_id)
  let regularQuery = sb
    .from('events')
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, color, source, source_id')
    .is('rrule', null)
    .is('series_id', null)
    .lte('starts_at', to)
    .gte('ends_at', from)
    .order('starts_at', { ascending: true });

  regularQuery = baseFilters(regularQuery);

  const { data: regularEvents, error: regularError } = await regularQuery;

  if (regularError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEventsRecurring] regular events query error:', regularError);
    }
    throw new Error(`Regular events query failed: ${regularError.message}`);
  }

  // 2. Query series masters (has rrule)
  // We need to be more lenient with time filtering since series can generate occurrences
  // beyond their original starts_at/ends_at
  let seriesQuery = sb
    .from('events')
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, color, rrule, exdates, source, source_id')
    .not('rrule', 'is', null);

  seriesQuery = baseFilters(seriesQuery);

  const { data: seriesMasters, error: seriesError } = await seriesQuery;

  if (seriesError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEventsRecurring] series masters query error:', seriesError);
    }
    throw new Error(`Series masters query failed: ${seriesError.message}`);
  }

  // 3. Query overrides (has series_id)
  let overridesQuery = sb
    .from('events')
    .select(
      'id, series_id, original_start, calendar_id, title, location, starts_at, ends_at, all_day, color, source, source_id'
    )
    .not('series_id', 'is', null)
    .lte('starts_at', to)
    .gte('ends_at', from);

  overridesQuery = baseFilters(overridesQuery);

  const { data: overrides, error: overridesError } = await overridesQuery;

  if (overridesError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEventsRecurring] overrides query error:', overridesError);
    }
    throw new Error(`Overrides query failed: ${overridesError.message}`);
  }

  // 4. Materialize everything
  const materializedEvents = materializeEvents(
    (regularEvents || []) as MaterializedEvent[],
    (seriesMasters || []) as SeriesMaster[],
    (overrides || []) as EventOverride[],
    fromDate,
    toDate
  );

  // 5. Sort by start time
  materializedEvents.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return materializedEvents;
}

import { supabaseServer } from '@/lib/supabase/server';
import { expandBetween } from '@/lib/rrule';
import type { EventInstance, SeriesMeta } from '@/types/events';

/**
 * List events for a given time window, expanding recurring series
 *
 * This function:
 * 1. Fetches standalone (non-recurring) events that overlap [from, to]
 * 2. Fetches series masters (events with rrule) that might have occurrences in the window
 * 3. Expands each series into individual occurrences using RRULE
 * 4. Fetches override instances (per-occurrence modifications)
 * 5. Merges overrides into the expanded series
 * 6. Returns a flat array of EventInstance objects
 *
 * @param from - ISO 8601 UTC start of window
 * @param to - ISO 8601 UTC end of window
 * @param calendarId - Optional filter by calendar
 * @returns Array of EventInstance objects (standalone + expanded series + overrides)
 */
export async function listEvents({
  from,
  to,
  calendarId,
}: {
  from: string;
  to: string;
  calendarId?: string;
}): Promise<EventInstance[]> {
  const sb = await supabaseServer();
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // STEP 1: Fetch standalone events (no rrule, no series_id)
  // These are simple one-off events that overlap the window
  let standaloneQuery = sb
    .from('events')
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, calendars(color)')
    .lte('starts_at', to)
    .gte('ends_at', from)
    .is('rrule', null)
    .is('series_id', null)
    .order('starts_at', { ascending: true });

  if (calendarId) standaloneQuery = standaloneQuery.eq('calendar_id', calendarId);

  const { data: standaloneData, error: standaloneError } = await standaloneQuery;
  if (standaloneError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEvents] standalone query error:', standaloneError);
    }
    throw new Error(standaloneError.message);
  }

  // Convert standalone events to EventInstance format
  const standaloneInstances: EventInstance[] = (standaloneData || []).map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: row.id as string,
      calendar_id: row.calendar_id as string,
      title: row.title as string,
      location: (row.location as string | null) || undefined,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      all_day: row.all_day as boolean,
      color:
        ((row.calendars as Record<string, unknown> | null)?.color as string | null) || undefined,
      source: 'local',
    };
  });

  // STEP 2: Fetch series masters (events with rrule, no series_id)
  // These are the template events for recurring series
  let seriesQuery = sb
    .from('events')
    .select(
      'id, calendar_id, title, location, starts_at, ends_at, all_day, rrule, exdates, calendars(color)'
    )
    .not('rrule', 'is', null)
    .is('series_id', null)
    .order('starts_at', { ascending: true });

  if (calendarId) seriesQuery = seriesQuery.eq('calendar_id', calendarId);

  const { data: seriesData, error: seriesError } = await seriesQuery;
  if (seriesError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEvents] series query error:', seriesError);
    }
    throw new Error(seriesError.message);
  }

  // STEP 3: Expand series into individual occurrences
  const expandedInstances: EventInstance[] = [];

  for (const master of seriesData || []) {
    const row = master as Record<string, unknown>;
    const masterId = row.id as string;
    const rrule = row.rrule as string;
    const dtstart = row.starts_at as string;
    const dtend = row.ends_at as string;
    const exdates = (row.exdates as string[] | null) || [];

    // Calculate duration in milliseconds (DST-safe via UTC math)
    const durationMs = new Date(dtend).getTime() - new Date(dtstart).getTime();

    try {
      // Expand the series using the RRULE library
      const occurrences = expandBetween({
        dtstart,
        rule: rrule,
        exdates,
        from: fromDate,
        to: toDate,
      });

      // Convert each occurrence Date to an EventInstance
      for (const occStart of occurrences) {
        const occStartISO = occStart.toISOString();
        const occEndISO = new Date(occStart.getTime() + durationMs).toISOString();

        // Create series metadata for this instance
        const seriesMeta: SeriesMeta = {
          master_id: masterId,
          original_start: occStartISO,
          is_override: false,
        };

        expandedInstances.push({
          id: `${masterId}@${occStartISO}`, // Synthetic ID for series instances
          calendar_id: row.calendar_id as string,
          title: row.title as string,
          location: (row.location as string | null) || undefined,
          starts_at: occStartISO,
          ends_at: occEndISO,
          all_day: row.all_day as boolean,
          color:
            ((row.calendars as Record<string, unknown> | null)?.color as string | null) ||
            undefined,
          source: 'local',
          _series: seriesMeta,
        });
      }
    } catch (err) {
      console.error(`Failed to expand series ${masterId}:`, err);
      // Continue processing other series even if one fails
    }
  }

  // STEP 4: Fetch override instances (per-occurrence modifications)
  // These are events with series_id that modify or replace a specific occurrence
  let overridesQuery = sb
    .from('events')
    .select(
      'id, calendar_id, title, location, starts_at, ends_at, all_day, series_id, original_start, calendars(color)'
    )
    .not('series_id', 'is', null)
    .gte('original_start', from)
    .lte('original_start', to)
    .order('original_start', { ascending: true });

  if (calendarId) overridesQuery = overridesQuery.eq('calendar_id', calendarId);

  const { data: overridesData, error: overridesError } = await overridesQuery;
  if (overridesError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEvents] overrides query error:', overridesError);
    }
    throw new Error(overridesError.message);
  }

  // STEP 5: Merge overrides into expanded instances
  // For each override, replace the matching expanded instance
  const overridesMap = new Map<string, EventInstance>();

  for (const override of overridesData || []) {
    const row = override as Record<string, unknown>;
    const seriesId = row.series_id as string;
    const originalStart = row.original_start as string;

    // Create the override instance
    const overrideInstance: EventInstance = {
      id: row.id as string, // Use the actual override row ID
      calendar_id: row.calendar_id as string,
      title: row.title as string,
      location: (row.location as string | null) || undefined,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      all_day: row.all_day as boolean,
      color:
        ((row.calendars as Record<string, unknown> | null)?.color as string | null) || undefined,
      source: 'local',
      _series: {
        master_id: seriesId,
        original_start: originalStart,
        is_override: true,
      },
    };

    // Map key: "master_id@original_start"
    overridesMap.set(`${seriesId}@${originalStart}`, overrideInstance);
  }

  // Replace expanded instances with their overrides
  const mergedSeries = expandedInstances.map((instance) => {
    if (instance._series) {
      const key = `${instance._series.master_id}@${instance._series.original_start}`;
      const override = overridesMap.get(key);
      if (override) {
        return override; // Use override instead of expanded instance
      }
    }
    return instance;
  });

  // STEP 6: Combine all instances and sort by start time
  const allInstances = [...standaloneInstances, ...mergedSeries];
  allInstances.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return allInstances;
}

/**
 * Create a new event (standalone or series master)
 *
 * @param e - Event data including optional rrule for recurring events
 * @returns Created event instance
 */
export async function createEvent(e: {
  calendar_id: string;
  title: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  rrule?: string; // Optional RRULE for recurring events
}): Promise<EventInstance> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('events')
    .insert({
      calendar_id: e.calendar_id,
      title: e.title,
      location: e.location || null,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day || false,
      rrule: e.rrule || null,
    })
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, rrule, calendars(color)')
    .single();

  if (error) throw new Error(error.message);

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    calendar_id: row.calendar_id as string,
    title: row.title as string,
    location: (row.location as string | null) || undefined,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    all_day: row.all_day as boolean,
    color: ((row.calendars as Record<string, unknown> | null)?.color as string | null) || undefined,
    source: 'local',
  };
}

export async function getPrimaryCalendarId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from('calendars')
    .select('id')
    .eq('is_primary', true)
    .limit(1)
    .single();

  return data?.id || null;
}

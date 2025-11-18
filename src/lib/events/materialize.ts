/**
 * materialize.ts - Expand RRULE recurring events into concrete occurrences
 *
 * This module handles:
 * - Expanding recurring event series into individual occurrences within a time window
 * - Applying exclusion dates (exdates)
 * - Merging with override events
 * - Filtering out occurrences that have been overridden
 */

import { RRule } from 'rrule';

export interface SeriesMaster {
  id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  all_day?: boolean;
  color?: string;
  rrule: string;
  exdates?: string[]; // ISO timestamp strings
  source?: string;
  source_id?: string;
}

export interface EventOverride {
  id: string;
  series_id: string;
  original_start: string; // ISO timestamp of the occurrence being overridden
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  all_day?: boolean;
  color?: string;
  source?: string;
  source_id?: string;
}

export interface MaterializedEvent {
  id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  all_day?: boolean;
  color?: string;
  source?: string;
  source_id?: string;
  // Recurring metadata
  is_recurring?: boolean;
  series_id?: string;
  original_start?: string;
}

/**
 * Expand recurring event series into concrete occurrences
 */
export function expandSeries(
  seriesMasters: SeriesMaster[],
  overrides: EventOverride[],
  from: Date,
  to: Date
): MaterializedEvent[] {
  const result: MaterializedEvent[] = [];

  // Create lookup map of overrides by series_id and original_start
  const overrideMap = new Map<string, Set<string>>();
  overrides.forEach((override) => {
    const key = override.series_id;
    if (!overrideMap.has(key)) {
      overrideMap.set(key, new Set());
    }
    overrideMap.get(key)!.add(override.original_start);
  });

  // Expand each series
  seriesMasters.forEach((master) => {
    try {
      // Parse RRULE
      const rule = RRule.fromString(master.rrule);

      // Get occurrences within the time window
      const occurrences = rule.between(from, to, true); // inclusive=true

      // Calculate event duration
      const masterStart = new Date(master.starts_at);
      const masterEnd = new Date(master.ends_at);
      const durationMs = masterEnd.getTime() - masterStart.getTime();

      // Parse exdates (exclusion dates)
      const exdateSet = new Set(
        (master.exdates || []).map((d) => new Date(d).toISOString())
      );

      // Get overridden dates for this series
      const overriddenDates = overrideMap.get(master.id) || new Set();

      // Create materialized events for each occurrence
      occurrences.forEach((occurrenceStart) => {
        const occurrenceStartISO = occurrenceStart.toISOString();

        // Skip if excluded
        if (exdateSet.has(occurrenceStartISO)) return;

        // Skip if overridden (there's an override event for this occurrence)
        if (overriddenDates.has(occurrenceStartISO)) return;

        // Calculate end time based on original duration
        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

        result.push({
          id: `${master.id}_${occurrenceStartISO}`, // Synthetic ID
          calendar_id: master.calendar_id,
          title: master.title,
          starts_at: occurrenceStartISO,
          ends_at: occurrenceEnd.toISOString(),
          location: master.location,
          all_day: master.all_day,
          color: master.color,
          source: master.source,
          source_id: master.source_id,
          // Recurring metadata
          is_recurring: true,
          series_id: master.id,
          original_start: occurrenceStartISO,
        });
      });
    } catch (err) {
      console.error(
        `[materialize] Failed to expand series ${master.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      // Continue processing other series
    }
  });

  return result;
}

/**
 * Merge regular events, materialized occurrences, and overrides
 */
export function mergeEvents(
  regularEvents: MaterializedEvent[],
  materializedOccurrences: MaterializedEvent[],
  overrides: EventOverride[]
): MaterializedEvent[] {
  // Convert overrides to MaterializedEvent format
  const overrideEvents: MaterializedEvent[] = overrides.map((override) => ({
    id: override.id,
    calendar_id: override.calendar_id,
    title: override.title,
    starts_at: override.starts_at,
    ends_at: override.ends_at,
    location: override.location,
    all_day: override.all_day,
    color: override.color,
    source: override.source,
    source_id: override.source_id,
    // Recurring metadata
    is_recurring: true,
    series_id: override.series_id,
    original_start: override.original_start,
  }));

  // Combine all events
  return [...regularEvents, ...materializedOccurrences, ...overrideEvents];
}

/**
 * Main function: Materialize all events for a time window
 */
export function materializeEvents(
  regularEvents: MaterializedEvent[], // Non-recurring events (rrule is null)
  seriesMasters: SeriesMaster[], // Events with rrule set
  overrides: EventOverride[], // Events with series_id set
  from: Date,
  to: Date
): MaterializedEvent[] {
  // 1. Expand series into occurrences
  const materializedOccurrences = expandSeries(seriesMasters, overrides, from, to);

  // 2. Merge everything together
  return mergeEvents(regularEvents, materializedOccurrences, overrides);
}

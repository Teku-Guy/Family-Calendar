/**
 * Event Type Definitions
 *
 * Centralized type definitions for calendar events, including support for
 * recurring events, series masters, and per-occurrence overrides.
 */

/**
 * Database Event Row
 *
 * Represents a single row in the events table. This can be:
 * - A standalone event (no rrule, no series_id)
 * - A series master (has rrule, no series_id)
 * - An override instance (has series_id and original_start)
 */
export type DBEvent = {
  id: string;
  calendar_id: string;
  title: string;
  starts_at: string; // ISO 8601 UTC
  ends_at: string; // ISO 8601 UTC
  location?: string;
  color?: string;
  all_day: boolean;
  rrule?: string | null; // RFC 5545 recurrence rule (only on series masters)
  exdates?: string[] | null; // ISO 8601 UTC timestamps (only on series masters)
  series_id?: string | null; // FK to series master (only on overrides)
  original_start?: string | null; // ISO 8601 UTC (only on overrides)
  created_at?: string;
  updated_at?: string;
};

/**
 * Series Metadata
 *
 * Metadata attached to event instances that are part of a recurring series.
 * This allows the UI to distinguish between standalone events and series instances.
 */
export type SeriesMeta = {
  master_id: string; // ID of the series master event
  original_start: string; // ISO 8601 UTC timestamp of this instance's original start
  is_override?: boolean; // True if this instance has custom overrides
};

/**
 * Event Instance
 *
 * A materialized event instance ready for display in the calendar.
 * This is the result of expanding recurring events into individual occurrences.
 *
 * For standalone events: _series is undefined
 * For series instances: _series contains metadata about the series
 */
export type EventInstance = {
  id: string; // For overrides: override row ID; for series: synthetic ID
  calendar_id: string;
  title: string;
  starts_at: string; // ISO 8601 UTC
  ends_at: string; // ISO 8601 UTC
  location?: string;
  color?: string;
  all_day: boolean;
  source?: 'local' | 'google'; // Source of the event
  _series?: SeriesMeta; // Present if this is part of a recurring series
};

/**
 * Event Draft (for creating/editing)
 *
 * Form data structure used in the EventModal component.
 * Uses local datetime-local format (YYYY-MM-DDTHH:mm) for inputs.
 */
export type EventDraft = {
  id?: string;
  calendar_id: string;
  title?: string;
  starts_at?: string; // Local datetime-local format
  ends_at?: string; // Local datetime-local format
  location?: string;
  color?: string;
  all_day?: boolean;
  rrule?: string; // RRULE string for creating recurring events
  _series?: SeriesMeta; // Present when editing a series instance
};

/**
 * Series Edit Scope
 *
 * When editing a recurring event instance, the user chooses whether to:
 * - Edit only this occurrence (creates/updates an override)
 * - Edit the entire series (updates the master event)
 */
export type SeriesEditScope = 'this' | 'all';

/**
 * RRULE Frequency Types
 *
 * Common recurrence frequencies for UI dropdowns.
 */
export type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/**
 * RRULE Day of Week
 *
 * RFC 5545 day codes used in BYDAY parameter.
 */
export type RRuleDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

/**
 * RRULE Builder Options
 *
 * Simplified interface for building RRULE strings in the UI.
 */
export type RRuleOptions = {
  freq: RRuleFrequency;
  interval?: number; // Default: 1
  count?: number; // Number of occurrences (mutually exclusive with until)
  until?: string; // ISO 8601 UTC (mutually exclusive with count)
  byday?: RRuleDay[]; // Days of week (for WEEKLY/MONTHLY)
  bymonthday?: number[]; // Days of month (for MONTHLY)
};

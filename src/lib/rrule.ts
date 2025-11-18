/**
 * RRULE Helper Utilities
 *
 * This module provides utilities for working with RFC 5545 recurrence rules.
 * It handles:
 * - Building RRuleSets from DTSTART + RRULE strings
 * - Expanding recurring events into individual occurrences
 * - Managing exception dates (EXDATE)
 * - Timezone-safe date conversions
 *
 * @see https://github.com/jakubroztocil/rrule
 * @see https://tools.ietf.org/html/rfc5545
 */

import { RRule, RRuleSet, rrulestr } from 'rrule';

/**
 * Build an RRuleSet from DTSTART, RRULE string, and exception dates
 *
 * @param dtstartISO - ISO 8601 UTC datetime string (e.g., "2025-10-15T10:00:00.000Z")
 * @param rule - RRULE string (e.g., "RRULE:FREQ=WEEKLY;BYDAY=MO,WE")
 * @param exdates - Optional array of ISO 8601 UTC datetime strings to exclude
 * @returns RRuleSet ready for expansion
 *
 * @example
 * ```ts
 * const set = buildSet(
 *   "2025-10-15T10:00:00.000Z",
 *   "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
 *   ["2025-10-16T10:00:00.000Z"]
 * );
 * ```
 */
export function buildSet(dtstartISO: string, rule: string, exdates?: string[]): RRuleSet {
  // Parse DTSTART as UTC Date
  const dt = new Date(dtstartISO);

  // Format DTSTART for RRULE library (iCalendar format: YYYYMMDDTHHmmssZ)
  // Example: 20251015T100000Z
  const DTSTART = dt.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z');

  // Build the RRuleSet from the combined DTSTART + RRULE string
  // forceset: true ensures we always get an RRuleSet (not just RRule)
  const set = rrulestr(`DTSTART:${DTSTART}\n${rule}`, { forceset: true }) as RRuleSet;

  // Add exception dates to the set
  // Each exdate removes one occurrence from the expansion
  (exdates || []).forEach((exdate) => {
    set.exdate(new Date(exdate));
  });

  return set;
}

/**
 * Expand recurring events between two dates (viewport window)
 *
 * This function generates all occurrences of a recurring event within a given
 * time window. It respects exception dates and returns Date objects in UTC.
 *
 * @param params - Expansion parameters
 * @param params.dtstart - ISO 8601 UTC datetime of the first occurrence
 * @param params.rule - RRULE string defining the recurrence pattern
 * @param params.exdates - Optional array of ISO 8601 UTC datetimes to exclude
 * @param params.from - Start of the expansion window (inclusive)
 * @param params.to - End of the expansion window (inclusive)
 * @returns Array of Date objects representing occurrence start times (UTC)
 *
 * @example
 * ```ts
 * const occurrences = expandBetween({
 *   dtstart: "2025-10-15T10:00:00.000Z",
 *   rule: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
 *   exdates: ["2025-10-16T10:00:00.000Z"],
 *   from: new Date("2025-10-15T00:00:00.000Z"),
 *   to: new Date("2025-10-22T23:59:59.999Z")
 * });
 * // Returns: [Date(Mon 10/15 10:00), Date(Wed 10/22 10:00)]
 * // (Wed 10/16 excluded via exdates)
 * ```
 */
export function expandBetween({
  dtstart,
  rule,
  exdates,
  from,
  to,
}: {
  dtstart: string;
  rule: string;
  exdates?: string[];
  from: Date;
  to: Date;
}): Date[] {
  const set = buildSet(dtstart, rule, exdates);

  // Generate all occurrences between from and to (inclusive on both ends)
  // The rrule library returns Date objects in UTC when DTSTART has Z suffix
  return set.between(from, to, true);
}

/**
 * Convert UTC ISO string to local datetime-local input format
 *
 * Datetime-local inputs expect YYYY-MM-DDTHH:mm format in the user's local timezone.
 * This function converts a UTC ISO string to that format.
 *
 * @param isoUTC - ISO 8601 UTC datetime string (e.g., "2025-10-15T10:00:00.000Z")
 * @returns Local datetime string for input (e.g., "2025-10-15T06:00" in ET)
 *
 * @example
 * ```ts
 * toLocalInput("2025-10-15T10:00:00.000Z") // "2025-10-15T06:00" (if user in ET)
 * ```
 */
export function toLocalInput(isoUTC: string): string {
  const d = new Date(isoUTC);

  // Adjust for timezone offset to get local time
  const offset = d.getTimezoneOffset() * 60000;
  const localTime = new Date(d.getTime() - offset);

  // Return in YYYY-MM-DDTHH:mm format
  return localTime.toISOString().slice(0, 16);
}

/**
 * Convert local datetime-local input to UTC ISO string
 *
 * This is the inverse of toLocalInput. Takes a datetime-local input value
 * and converts it to a UTC ISO string suitable for database storage.
 *
 * @param localInput - Local datetime string from input (e.g., "2025-10-15T06:00")
 * @returns UTC ISO string (e.g., "2025-10-15T10:00:00.000Z" if user in ET)
 *
 * @example
 * ```ts
 * toUTC("2025-10-15T06:00") // "2025-10-15T10:00:00.000Z" (if user in ET)
 * ```
 */
export function toUTC(localInput: string): string {
  const d = new Date(localInput);
  return d.toISOString();
}

/**
 * Format RRULE for display
 *
 * Converts an RRULE string into human-readable text.
 *
 * @param rule - RRULE string (e.g., "RRULE:FREQ=WEEKLY;BYDAY=MO,WE")
 * @returns Human-readable description (e.g., "Weekly on Monday, Wednesday")
 *
 * @example
 * ```ts
 * formatRRule("RRULE:FREQ=WEEKLY;BYDAY=MO,WE") // "Weekly on Monday, Wednesday"
 * ```
 */
export function formatRRule(rule: string): string {
  try {
    const rrule = rrulestr(rule) as RRule;
    return rrule.toText();
  } catch {
    return rule; // Fallback to raw string if parsing fails
  }
}

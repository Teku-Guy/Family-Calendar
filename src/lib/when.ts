/**
 * Timezone & Formatting Helpers (UTC-in, TZ-out)
 *
 * This module provides timezone-safe utilities for converting between UTC storage
 * and local timezone display. All database timestamps are stored in UTC, and these
 * helpers ensure correct conversion for display and editing.
 *
 * ## Key Principles:
 * - Store in UTC (timestamptz in Postgres)
 * - Display in user's local timezone
 * - DST-safe: Let JavaScript Date handle timezone rules
 * - Locale-aware formatting
 *
 * @module lib/when
 */

/**
 * Minute block coordinates for calendar rendering
 */
export type MinuteBlock = {
  top: number; // Pixels from day start
  height: number; // Pixels tall
};

/**
 * Convert a UTC ISO string to local datetime-local input format
 *
 * Datetime-local inputs expect YYYY-MM-DDTHH:mm in the user's local timezone.
 * This function converts a UTC timestamp to that format.
 *
 * @param isoUTC - ISO 8601 UTC timestamp (e.g., "2025-10-15T14:00:00.000Z")
 * @returns Local datetime string (e.g., "2025-10-15T10:00" in ET)
 *
 * @example
 * ```ts
 * toLocalInput("2025-10-15T14:00:00.000Z") // "2025-10-15T10:00" (if user in ET)
 * ```
 */
export function toLocalInput(isoUTC: string): string {
  const d = new Date(isoUTC);

  // Adjust for timezone offset to get local wall clock time
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);

  // Return in YYYY-MM-DDTHH:mm format
  return local.toISOString().slice(0, 16);
}

/**
 * Convert a local datetime-local input value to UTC ISO string
 *
 * This is the inverse of toLocalInput. Takes a datetime-local input value
 * (which represents local time) and converts it to UTC.
 *
 * @param localValue - Local datetime string (e.g., "2025-10-15T10:00")
 * @returns UTC ISO string (e.g., "2025-10-15T14:00:00.000Z" if user in ET)
 *
 * @example
 * ```ts
 * fromLocalInput("2025-10-15T10:00") // "2025-10-15T14:00:00.000Z" (if user in ET)
 * ```
 */
export function fromLocalInput(localValue: string): string {
  // Parse as local time (browser interprets as user's timezone)
  const d = new Date(localValue);

  // Return as UTC ISO string
  return d.toISOString();
}

/**
 * Format a time in the user's timezone
 *
 * Uses Intl.DateTimeFormat for locale-aware, timezone-correct time formatting.
 *
 * @param isoUTC - UTC ISO timestamp
 * @param opts - Additional Intl.DateTimeFormat options
 * @returns Formatted time string (e.g., "2:30 PM")
 *
 * @example
 * ```ts
 * fmtTime("2025-10-15T14:30:00.000Z") // "10:30 AM" (if user in ET)
 * fmtTime("2025-10-15T14:30:00.000Z", { hour12: false }) // "10:30"
 * ```
 */
export function fmtTime(
  isoUTC: string,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(new Date(isoUTC));
}

/**
 * Format a date in the user's timezone
 *
 * Uses Intl.DateTimeFormat for locale-aware, timezone-correct date formatting.
 *
 * @param isoUTC - UTC ISO timestamp
 * @param opts - Additional Intl.DateTimeFormat options
 * @returns Formatted date string (e.g., "Oct 15")
 *
 * @example
 * ```ts
 * fmtDate("2025-10-15T14:30:00.000Z") // "Oct 15"
 * fmtDate("2025-10-15T14:30:00.000Z", { weekday: 'long' }) // "Wednesday, Oct 15"
 * ```
 */
export function fmtDate(
  isoUTC: string,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(new Date(isoUTC));
}

/**
 * Format a short time range with shared AM/PM suffix
 *
 * Produces compact, readable time ranges like "2:30–3:15 PM" or "11:45 AM–12:15 PM".
 * When start and end share the same AM/PM period, it's only shown once.
 *
 * @param startUTC - Start time in UTC
 * @param endUTC - End time in UTC
 * @returns Formatted range string
 *
 * @example
 * ```ts
 * fmtRange("2025-10-15T14:30:00.000Z", "2025-10-15T15:15:00.000Z")
 * // "10:30–11:15 AM" (if user in ET, both times are AM)
 *
 * fmtRange("2025-10-15T15:45:00.000Z", "2025-10-15T16:15:00.000Z")
 * // "11:45 AM–12:15 PM" (different periods, both shown)
 *
 * fmtRange("2025-10-15T15:00:00.000Z", "2025-10-16T16:00:00.000Z")
 * // "Oct 15 11:00 AM–Oct 16 12:00 PM" (different days)
 * ```
 */
export function fmtRange(startUTC: string, endUTC: string): string {
  const s = new Date(startUTC);
  const e = new Date(endUTC);

  // Check if same day
  const sameDay = s.toDateString() === e.toDateString();

  // Format times
  const tf = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Add date prefix if different days
  const dayPrefix = sameDay ? '' : `${fmtDate(startUTC)} `;

  let startStr = tf.format(s);
  const endStr = tf.format(e);

  // Extract AM/PM suffixes (if present)
  const startSuffix = /\s[AP]M$/i.exec(startStr)?.[0] ?? '';
  const endSuffix = /\s[AP]M$/i.exec(endStr)?.[0] ?? '';

  // If both have the same suffix, remove it from start time
  if (startSuffix && startSuffix === endSuffix) {
    startStr = startStr.replace(startSuffix, '');
  }

  // Build final range string
  return `${dayPrefix}${startStr}–${endStr}`.trim();
}

/**
 * Calculate minute offset from day start in local timezone
 *
 * This is DST-safe because JavaScript Date automatically handles timezone rules.
 * Returns the number of minutes between midnight (local time) and the given timestamp.
 *
 * @param isoUTC - UTC ISO timestamp
 * @param day - Reference day (midnight will be used as baseline)
 * @returns Minutes from midnight (can be negative or >1440 for multi-day events)
 *
 * @example
 * ```ts
 * const day = new Date("2025-10-15T00:00:00");
 * minutesFromDayStart("2025-10-15T14:30:00.000Z", day)
 * // Returns: 630 (10:30 AM in ET = 10*60 + 30)
 *
 * // DST-safe: On spring forward day (2AM becomes 3AM):
 * const dstDay = new Date("2025-03-09T00:00:00");
 * minutesFromDayStart("2025-03-09T14:00:00.000Z", dstDay)
 * // Correctly accounts for the "missing" hour
 * ```
 */
export function minutesFromDayStart(isoUTC: string, day: Date): number {
  // Set to midnight local time (DST-aware)
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);

  // Parse the event time (in local timezone)
  const d = new Date(isoUTC);

  // Calculate difference in milliseconds, convert to minutes
  return Math.round((d.getTime() - d0.getTime()) / 60000);
}

/**
 * Format duration in hours and minutes
 *
 * @param minutes - Duration in minutes
 * @returns Human-readable duration (e.g., "1h 30m", "45m")
 *
 * @example
 * ```ts
 * fmtDuration(90) // "1h 30m"
 * fmtDuration(45) // "45m"
 * fmtDuration(120) // "2h"
 * ```
 */
export function fmtDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculate duration between two timestamps in minutes
 *
 * @param startUTC - Start time in UTC
 * @param endUTC - End time in UTC
 * @returns Duration in minutes
 *
 * @example
 * ```ts
 * duration("2025-10-15T14:00:00.000Z", "2025-10-15T15:30:00.000Z") // 90
 * ```
 */
export function duration(startUTC: string, endUTC: string): number {
  const s = new Date(startUTC);
  const e = new Date(endUTC);
  return Math.round((e.getTime() - s.getTime()) / 60000);
}

/**
 * Check if a timestamp is today in the user's timezone
 *
 * @param isoUTC - UTC ISO timestamp
 * @returns True if the timestamp is today
 *
 * @example
 * ```ts
 * isToday("2025-10-15T14:00:00.000Z") // true if today is Oct 15 in user's TZ
 * ```
 */
export function isToday(isoUTC: string): boolean {
  const d = new Date(isoUTC);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param isoUTC - UTC ISO timestamp
 * @returns Relative time string
 *
 * @example
 * ```ts
 * fmtRelative("2025-10-15T12:00:00.000Z") // "2 hours ago" (if now is 2PM)
 * ```
 */
export function fmtRelative(isoUTC: string): string {
  const d = new Date(isoUTC);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (Math.abs(diffMins) < 60) {
    return diffMins === 0
      ? 'now'
      : diffMins > 0
      ? `in ${diffMins}m`
      : `${-diffMins}m ago`;
  }

  const diffHours = Math.round(diffMins / 60);
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${-diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays > 0 ? `in ${diffDays}d` : `${-diffDays}d ago`;
}

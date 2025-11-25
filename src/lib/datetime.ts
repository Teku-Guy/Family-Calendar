/**
 * Datetime utility functions for handling browser datetime-local inputs
 * and converting them to API-compatible ISO 8601 strings.
 */

/**
 * Convert a datetime-local string (YYYY-MM-DDTHH:mm) to ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
 *
 * Datetime-local inputs return strings without timezone information (e.g., "2025-11-25T13:00").
 * This function interprets the input as local time and converts it to UTC ISO format.
 *
 * @param datetimeLocal - String in format YYYY-MM-DDTHH:mm from datetime-local input
 * @returns ISO 8601 string in UTC (e.g., "2025-11-25T18:00:00.000Z")
 *
 * @example
 * // User in EST (UTC-5) selects "2025-11-25T13:00"
 * toISOString("2025-11-25T13:00") // "2025-11-25T18:00:00.000Z"
 */
export function toISOString(datetimeLocal: string): string {
  if (!datetimeLocal) {
    throw new Error('datetime-local string is required');
  }

  // Parse as local time
  const localDate = new Date(datetimeLocal);

  // Validate parsing succeeded
  if (isNaN(localDate.getTime())) {
    throw new Error(`Invalid datetime-local format: ${datetimeLocal}`);
  }

  // Convert to ISO 8601 UTC string
  return localDate.toISOString();
}

/**
 * Convert a Date object to datetime-local format (YYYY-MM-DDTHH:mm)
 * This is used when populating datetime-local inputs with existing data.
 *
 * @param date - Date object to convert
 * @returns String in format YYYY-MM-DDTHH:mm (local time)
 *
 * @example
 * // UTC time "2025-11-25T18:00:00.000Z" in EST (UTC-5)
 * toDatetimeLocal(new Date("2025-11-25T18:00:00.000Z")) // "2025-11-25T13:00"
 */
export function toDatetimeLocal(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Valid Date object is required');
  }

  // Adjust for timezone offset to get local time
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);

  // Format as YYYY-MM-DDTHH:mm (truncate seconds and milliseconds)
  return localDate.toISOString().slice(0, 16);
}

/**
 * Validate that a datetime string is in valid ISO 8601 format
 *
 * @param datetime - String to validate
 * @returns true if valid ISO 8601, false otherwise
 */
export function isValidISO(datetime: string): boolean {
  if (!datetime) return false;

  try {
    const date = new Date(datetime);
    return !isNaN(date.getTime()) && datetime.includes('T') && datetime.includes('Z');
  } catch {
    return false;
  }
}

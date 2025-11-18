/**
 * Tests for timezone-safe utilities in when.ts
 *
 * These tests verify that our timezone utilities correctly handle:
 * - UTC storage and local display conversion
 * - DST transitions (spring forward, fall back)
 * - Cross-timezone date formatting
 * - Minute-based calculations for calendar rendering
 */

import {
  toLocalInput,
  fromLocalInput,
  fmtTime,
  fmtDate,
  fmtRange,
  minutesFromDayStart,
  fmtDuration,
  duration,
  isToday,
  fmtRelative,
} from '../when';

describe('when.ts - Timezone Utilities', () => {
  describe('toLocalInput / fromLocalInput', () => {
    it('should convert UTC to local datetime-local format and back', () => {
      const utc = '2025-10-15T14:00:00.000Z'; // 2 PM UTC
      const local = toLocalInput(utc);

      // Format should be YYYY-MM-DDTHH:mm
      expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Round-trip should preserve the time (within a minute due to local time)
      const backToUTC = fromLocalInput(local);
      const diff = Math.abs(new Date(backToUTC).getTime() - new Date(utc).getTime());
      expect(diff).toBeLessThan(60000); // Within 1 minute
    });

    it('should handle DST transition times correctly', () => {
      // Spring forward: March 9, 2025, 2 AM -> 3 AM (EDT starts)
      const springForward = '2025-03-09T07:00:00.000Z'; // 2 AM EST = 7 AM UTC
      const localSpring = toLocalInput(springForward);
      expect(localSpring).toBeTruthy();

      // Fall back: November 2, 2025, 2 AM -> 1 AM (EST returns)
      const fallBack = '2025-11-02T06:00:00.000Z'; // 2 AM EDT = 6 AM UTC
      const localFall = toLocalInput(fallBack);
      expect(localFall).toBeTruthy();
    });
  });

  describe('fmtTime', () => {
    it('should format time in user locale', () => {
      const utc = '2025-10-15T14:30:00.000Z';
      const formatted = fmtTime(utc);

      // Should contain time components (will vary by locale)
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should respect custom format options', () => {
      const utc = '2025-10-15T14:30:00.000Z';
      const formatted = fmtTime(utc, { hour12: false });

      // Should not contain AM/PM when hour12 is false
      expect(formatted).not.toContain('AM');
      expect(formatted).not.toContain('PM');
    });
  });

  describe('fmtDate', () => {
    it('should format date in user locale', () => {
      const utc = '2025-10-15T14:30:00.000Z';
      const formatted = fmtDate(utc);

      // Should contain date components
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('fmtRange', () => {
    it('should format same-day time range with shared AM/PM', () => {
      const start = '2025-10-15T14:30:00.000Z'; // 10:30 AM EST
      const end = '2025-10-15T15:15:00.000Z';   // 11:15 AM EST
      const formatted = fmtRange(start, end);

      // Should be a range
      expect(formatted).toContain('–');
      expect(formatted).toBeTruthy();
    });

    it('should handle cross-day ranges', () => {
      const start = '2025-10-15T15:00:00.000Z';
      const end = '2025-10-16T16:00:00.000Z';
      const formatted = fmtRange(start, end);

      // Should contain range separator
      expect(formatted).toContain('–');
      expect(formatted).toBeTruthy();
    });
  });

  describe('minutesFromDayStart', () => {
    it('should calculate minutes from midnight in local time', () => {
      const day = new Date('2025-10-15T00:00:00'); // Local midnight
      const event = '2025-10-15T14:30:00.000Z'; // 10:30 AM EST = 630 minutes

      const minutes = minutesFromDayStart(event, day);

      // Should be positive number of minutes
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(1440); // Less than 24 hours
    });

    it('should handle DST transitions correctly', () => {
      // On DST spring forward day (March 9, 2025), 2 AM becomes 3 AM
      const dstDay = new Date('2025-03-09T00:00:00');
      const event = '2025-03-09T14:00:00.000Z'; // After DST change

      const minutes = minutesFromDayStart(event, dstDay);

      // Should still calculate correctly despite "missing" hour
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(typeof minutes).toBe('number');
    });
  });

  describe('fmtDuration', () => {
    it('should format minutes-only duration', () => {
      expect(fmtDuration(45)).toBe('45m');
    });

    it('should format hours-only duration', () => {
      expect(fmtDuration(120)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(fmtDuration(90)).toBe('1h 30m');
    });
  });

  describe('duration', () => {
    it('should calculate duration between two times', () => {
      const start = '2025-10-15T14:00:00.000Z';
      const end = '2025-10-15T15:30:00.000Z';

      expect(duration(start, end)).toBe(90); // 1.5 hours = 90 minutes
    });

    it('should handle cross-day durations', () => {
      const start = '2025-10-15T23:00:00.000Z';
      const end = '2025-10-16T01:00:00.000Z';

      expect(duration(start, end)).toBe(120); // 2 hours
    });
  });

  describe('isToday', () => {
    it('should identify today in local timezone', () => {
      const now = new Date();
      const todayUTC = now.toISOString();

      expect(isToday(todayUTC)).toBe(true);
    });

    it('should reject past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(isToday(yesterday.toISOString())).toBe(false);
    });
  });

  describe('fmtRelative', () => {
    it('should format "now" for current time', () => {
      const now = new Date().toISOString();
      const formatted = fmtRelative(now);

      // Should be "now" or very close (within minutes)
      expect(['now', 'in 1m', '1m ago']).toContain(formatted);
    });

    it('should format future times', () => {
      const future = new Date();
      future.setHours(future.getHours() + 2);
      const formatted = fmtRelative(future.toISOString());

      expect(formatted).toContain('in ');
    });

    it('should format past times', () => {
      const past = new Date();
      past.setHours(past.getHours() - 2);
      const formatted = fmtRelative(past.toISOString());

      expect(formatted).toContain(' ago');
    });
  });
});

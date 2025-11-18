/**
 * RecurringPatternBuilder.tsx - User-friendly recurring pattern UI
 *
 * Generates RRULE strings from user-friendly UI controls
 */

'use client';

import { useState, useEffect } from 'react';
import { RRule } from 'rrule';

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

type Props = {
  value?: string; // Existing RRULE string to parse
  onChange: (rrule: string) => void;
  startDate: string; // ISO datetime-local value
};

export default function RecurringPatternBuilder({ value, onChange, startDate }: Props) {
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
  const [interval, setInterval] = useState(1);
  const [count, setCount] = useState<number | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<string[]>([]);

  // Parse existing RRULE on mount
  useEffect(() => {
    if (!value) return;

    try {
      const rule = RRule.fromString(value);
      const options = rule.origOptions;

      if (options.freq !== undefined) {
        const freqMap: Record<number, Frequency> = {
          [RRule.DAILY]: 'DAILY',
          [RRule.WEEKLY]: 'WEEKLY',
          [RRule.MONTHLY]: 'MONTHLY',
          [RRule.YEARLY]: 'YEARLY',
        };
        setFrequency(freqMap[options.freq] || 'WEEKLY');
      }

      if (options.interval) setInterval(options.interval);
      if (options.count) setCount(options.count);
      if (options.until) setUntil(options.until.toISOString().slice(0, 10));

      if (options.byweekday && Array.isArray(options.byweekday)) {
        const dayMap: Record<number, string> = {
          0: 'MO',
          1: 'TU',
          2: 'WE',
          3: 'TH',
          4: 'FR',
          5: 'SA',
          6: 'SU',
        };
        setWeekdays(options.byweekday.map((d) => dayMap[d as number] || 'MO'));
      }
    } catch (err) {
      console.error('Failed to parse RRULE:', err);
    }
  }, [value]);

  // Generate RRULE string when inputs change
  useEffect(() => {
    try {
      const start = startDate ? new Date(startDate) : new Date();

      const options: any = {
        freq: RRule[frequency],
        interval,
        dtstart: start,
      };

      if (count !== null && count > 0) {
        options.count = count;
      } else if (until) {
        options.until = new Date(until);
      }

      if (frequency === 'WEEKLY' && weekdays.length > 0) {
        const dayMap: Record<string, number> = {
          MO: 0,
          TU: 1,
          WE: 2,
          TH: 3,
          FR: 4,
          SA: 5,
          SU: 6,
        };
        options.byweekday = weekdays.map((d) => dayMap[d]);
      }

      const rule = new RRule(options);
      const rruleStr = rule.toString().replace('DTSTART:', ''); // Remove DTSTART for cleaner storage
      onChange(rruleStr);
    } catch (err) {
      console.error('Failed to generate RRULE:', err);
    }
  }, [frequency, interval, count, until, weekdays, startDate, onChange]);

  const toggleWeekday = (day: string) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-zinc-800/50 p-4">
      <h3 className="text-sm font-medium">Recurring Pattern</h3>

      {/* Frequency selector */}
      <div>
        <label className="block text-xs opacity-80 mb-1">Repeats</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>

      {/* Interval */}
      <div>
        <label className="block text-xs opacity-80 mb-1">Every</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="100"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
            className="w-20 rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <span className="text-sm opacity-80">
            {frequency === 'DAILY' && (interval === 1 ? 'day' : 'days')}
            {frequency === 'WEEKLY' && (interval === 1 ? 'week' : 'weeks')}
            {frequency === 'MONTHLY' && (interval === 1 ? 'month' : 'months')}
            {frequency === 'YEARLY' && (interval === 1 ? 'year' : 'years')}
          </span>
        </div>
      </div>

      {/* Weekday selector (for weekly) */}
      {frequency === 'WEEKLY' && (
        <div>
          <label className="block text-xs opacity-80 mb-2">On days</label>
          <div className="flex flex-wrap gap-2">
            {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
                  weekdays.includes(day)
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* End condition */}
      <div>
        <label className="block text-xs opacity-80 mb-2">Ends</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="end_type"
              checked={count === null && until === null}
              onChange={() => {
                setCount(null);
                setUntil(null);
              }}
              className="h-4 w-4 accent-blue-500"
            />
            <span className="text-sm">Never</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="end_type"
              checked={count !== null}
              onChange={() => {
                setCount(10);
                setUntil(null);
              }}
              className="h-4 w-4 accent-blue-500"
            />
            <span className="text-sm">After</span>
            {count !== null && (
              <input
                type="number"
                min="1"
                max="999"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                className="w-20 rounded-md bg-zinc-800 px-2 py-1 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              />
            )}
            <span className="text-sm opacity-80">occurrences</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="end_type"
              checked={until !== null}
              onChange={() => {
                const futureDate = new Date();
                futureDate.setMonth(futureDate.getMonth() + 3);
                setUntil(futureDate.toISOString().slice(0, 10));
                setCount(null);
              }}
              className="h-4 w-4 accent-blue-500"
            />
            <span className="text-sm">On date</span>
            {until !== null && (
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="rounded-md bg-zinc-800 px-2 py-1 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              />
            )}
          </label>
        </div>
      </div>
    </div>
  );
}

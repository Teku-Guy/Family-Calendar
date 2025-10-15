'use client';

import MonthGrid from './MonthGrid';
import { addMonths } from '@/lib/time';

type Event = { id: string|number; start: string; end: string; title: string; color?: string };

export default function YearGrid({ cursor, events }: { cursor: Date; events: Event[] }) {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(new Date(cursor.getFullYear(), 0, 1), i));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {months.map((m, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 text-sm font-semibold">
            {m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <MonthGrid cursor={m} events={events} />
        </div>
      ))}
    </div>
  );
}
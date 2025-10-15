'use client';

import { addDays, startOfWeek, startOfMonth } from '@/lib/time';

type Event = { id: string|number; start: string; end: string; title: string; color?: string };

export default function MonthGrid({ cursor, events }: { cursor: Date; events: Event[] }) {
  const firstOfMonth = startOfMonth(cursor);
  const firstGrid = startOfWeek(firstOfMonth, 0); // grid starts on Sunday
  const totalDays = 42; // 6 weeks grid

  const cells = Array.from({ length: totalDays }, (_, i) => addDays(firstGrid, i));

  function eventsOnDay(d: Date) {
    return events.filter(ev => {
      const s = new Date(ev.start);
      return s.getFullYear()===d.getFullYear() && s.getMonth()===d.getMonth() && s.getDate()===d.getDate();
    }).slice(0, 3); // show first 3
  }

  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekdays.map(w => (
          <div key={w} className="px-3 py-2 text-xs opacity-70">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d,i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayNum = d.getDate();
          const list = eventsOnDay(d);
          return (
            <div key={i} className={`min-h-[96px] border-l border-t border-white/5 p-2 ${inMonth ? '' : 'opacity-50'}`}>
              <div className="text-xs mb-1">{dayNum}</div>
              <div className="space-y-1">
                {list.map(ev => (
                  <div key={ev.id} className="truncate rounded bg-white/10 px-2 py-1 text-[11px]">
                    {ev.title}
                  </div>
                ))}
                {list.length === 3 ? <div className="text-[10px] opacity-60">+ more…</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
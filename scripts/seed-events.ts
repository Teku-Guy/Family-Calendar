/**
 * Seed sample events for testing
 *
 * This script creates 3 sample events in the primary calendar.
 * Run with: bunx tsx scripts/seed-events.ts
 *
 * Prerequisites:
 * - User must have signed in at least once (creates primary calendar)
 * - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 */

import { sb } from './sb';

async function main() {
  console.log('🌱 Seeding events...\n');

  // Find a primary calendar to insert into
  const { data: cal, error: calErr } = await sb
    .from('calendars')
    .select('id, name')
    .eq('is_primary', true)
    .limit(1)
    .single();

  if (calErr || !cal) {
    throw new Error(
      'No primary calendar found. Sign in via the app first to trigger database bootstrap.'
    );
  }

  console.log(`📅 Found primary calendar: ${cal.name} (${cal.id})\n`);

  // Helper to create event time ranges
  const mk = (d: Date, startHour: number, startMin: number, endHour: number, endMin: number) => {
    const starts = new Date(d);
    starts.setHours(startHour, startMin, 0, 0);
    const ends = new Date(d);
    ends.setHours(endHour, endMin, 0, 0);
    return { starts_at: starts.toISOString(), ends_at: ends.toISOString() };
  };

  const today = new Date();
  const e1 = mk(today, 9, 0, 10, 30);   // 9:00 AM - 10:30 AM
  const e2 = mk(today, 12, 0, 13, 0);   // 12:00 PM - 1:00 PM
  const e3 = mk(today, 14, 30, 16, 0);  // 2:30 PM - 4:00 PM
  const e4 = mk(today, 6, 30, 7, 30);   // 6:30 AM - 7:30 AM

  const events = [
    {
      calendar_id: cal.id,
      title: 'Morning Jog (seed)',
      location: 'Park',
      color: '#22c55e',
      ...e4,
    },
    {
      calendar_id: cal.id,
      title: 'Team Standup (seed)',
      location: 'Office',
      color: '#3b82f6',
      ...e1,
    },
    {
      calendar_id: cal.id,
      title: 'Lunch with Mom (seed)',
      location: 'Cafe',
      color: '#eab308',
      ...e2,
    },
    {
      calendar_id: cal.id,
      title: 'Groceries (seed)',
      location: 'Market',
      color: '#f97316',
      ...e3,
    },
  ];

  const { data, error } = await sb.from('events').insert(events).select('id, title');

  if (error) {
    throw new Error(`Failed to seed events: ${error.message}`);
  }

  console.log(`✅ Seeded ${data?.length || 0} events:\n`);
  data?.forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.title}`);
  });

  console.log('\n🎉 Done! Refresh your calendar to see the new events.\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

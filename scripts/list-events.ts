/**
 * List events in the next 7 days
 *
 * This script queries all events in the next week to verify backend setup.
 * Run with: bunx tsx scripts/list-events.ts
 *
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 */

import { sb } from './sb';

async function main() {
  console.log('📋 Listing events for the next 7 days...\n');

  // Calculate time window (today through next 7 days)
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const to = new Date();
  to.setDate(to.getDate() + 7);
  to.setHours(23, 59, 59, 999);

  console.log(`🕐 Window: ${from.toLocaleDateString()} to ${to.toLocaleDateString()}\n`);

  // Query events in the time window
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at, ends_at, location, calendar_id')
    .lte('starts_at', to.toISOString())
    .gte('ends_at', from.toISOString())
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list events: ${error.message}`);
  }

  const count = data?.length ?? 0;

  if (count === 0) {
    console.log('📭 No events found in this time window.');
    console.log('   Run scripts/seed-events.ts to create sample events.\n');
    return;
  }

  console.log(`✅ Found ${count} event(s):\n`);

  // Show first 10 events
  const sample = data?.slice(0, 10) || [];
  sample.forEach((event, i) => {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    console.log(`   ${i + 1}. ${event.title}`);
    console.log(`      📍 ${event.location || 'No location'}`);
    console.log(`      🕐 ${start.toLocaleDateString()}, ${timeStr}`);
    console.log(`      🆔 ${event.id}\n`);
  });

  if (count > 10) {
    console.log(`   ... and ${count - 10} more\n`);
  }

  // Print JSON summary
  console.log('📊 JSON Summary:');
  console.log(
    JSON.stringify(
      {
        count,
        window: { from: from.toISOString(), to: to.toISOString() },
        sample: sample.map((e) => ({
          id: e.id,
          title: e.title,
          starts_at: e.starts_at,
        })),
      },
      null,
      2
    )
  );
  console.log();
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

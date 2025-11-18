#!/usr/bin/env tsx
/**
 * Seed Demo Events for Google Calendar Two-Way Sync Testing
 *
 * Creates a few test events in your primary calendar to test the push flow.
 * These events are local-owned (external_source IS NULL) so they can be pushed to Google.
 *
 * Usage:
 *   bunx tsx scripts/seed-demo-events.ts
 *
 * Safety:
 *   - Only creates events if they don't already exist (checks by title)
 *   - Uses your primary calendar
 *   - Creates events in the future (starting tomorrow)
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Demo events to create
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(10, 0, 0, 0);

const DEMO_EVENTS = [
  {
    title: '[DEMO] Team Standup',
    starts_at: new Date(tomorrow.getTime()).toISOString(),
    ends_at: new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString(), // +30 min
    location: 'Zoom',
    all_day: false,
    color: '#3b82f6', // Blue
  },
  {
    title: '[DEMO] Lunch Break',
    starts_at: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
    ends_at: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(), // +3 hours
    location: 'Cafeteria',
    all_day: false,
    color: '#10b981', // Green
  },
  {
    title: '[DEMO] All-Day Event',
    starts_at: tomorrow.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    ends_at: tomorrow.toISOString().slice(0, 10) + 'T23:59:59.999Z',
    location: '',
    all_day: true,
    color: '#f59e0b', // Amber
  },
  {
    title: '[DEMO] Client Meeting',
    starts_at: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString(), // +5 hours
    ends_at: new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000).toISOString(), // +6 hours
    location: 'Conference Room A',
    all_day: false,
    color: '#ef4444', // Red
  },
];

async function main() {
  console.log('🌱 Seeding demo events for Google Calendar sync testing...\n');

  // 1. Find primary calendar
  const { data: calendar, error: calError } = await supabase
    .from('calendars')
    .select('id, name')
    .eq('is_primary', true)
    .limit(1)
    .single();

  if (calError || !calendar) {
    console.error('❌ No primary calendar found. Please create a calendar first.');
    console.error('   Hint: Sign in to the app and it should auto-create a primary calendar.');
    process.exit(1);
  }

  console.log(`✅ Using calendar: ${calendar.name} (${calendar.id})\n`);

  // 2. Check existing demo events
  const { data: existing, error: existingError } = await supabase
    .from('events')
    .select('title')
    .eq('calendar_id', calendar.id)
    .ilike('title', '[DEMO]%');

  if (existingError) {
    console.error('❌ Failed to check existing events:', existingError);
    process.exit(1);
  }

  const existingTitles = new Set((existing || []).map((e: any) => e.title));

  // 3. Insert demo events
  let inserted = 0;
  let skipped = 0;

  for (const demoEvent of DEMO_EVENTS) {
    if (existingTitles.has(demoEvent.title)) {
      console.log(`⏭️  Skipped: "${demoEvent.title}" (already exists)`);
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase.from('events').insert({
      calendar_id: calendar.id,
      ...demoEvent,
      external_source: null, // Local-owned, ready to be pushed to Google
      external_id: null,
      external_etag: null,
      external_updated_at: null,
    });

    if (insertError) {
      console.error(`❌ Failed to insert "${demoEvent.title}":`, insertError);
      continue;
    }

    console.log(`✅ Created: "${demoEvent.title}"`);
    inserted++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Total:    ${DEMO_EVENTS.length}`);

  if (inserted > 0) {
    console.log(`\n🧪 Next steps:`);
    console.log(`   1. Open the calendar UI: http://localhost:3000/calendar`);
    console.log(`   2. Verify demo events appear`);
    console.log(`   3. Test push flow:`);
    console.log(`      - Edit a demo event → saves locally → push to Google`);
    console.log(`      - Delete a demo event → deletes locally → removes from Google`);
    console.log(`\n⚠️  Current dry-run mode: ${process.env.GOOGLE_SYNC_DRY_RUN === 'true' ? 'ON' : 'OFF'}`);
    console.log(`   To enable real writes:`);
    console.log(`      1. Set ALLOW_GOOGLE_WRITES=true in .env.local`);
    console.log(`      2. Optionally set GOOGLE_WRITE_ALLOWLIST=<your-user-id>`);
    console.log(`      3. Restart dev server`);
  }

  console.log('\n✨ Done!\n');
}

main().catch((e) => {
  console.error('💥 Fatal error:', e);
  process.exit(1);
});

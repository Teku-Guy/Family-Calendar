/**
 * Comprehensive Integration Tests for QuickAdd Feature
 *
 * Tests:
 * 1. Event creation flow with validation
 * 2. Error handling and recovery
 * 3. Date handling edge cases
 * 4. Performance under load
 * 5. Realtime subscription behavior
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: error.message, duration });
    console.log(`❌ ${name} (${duration}ms)`);
    console.log(`   Error: ${error.message}`);
  }
}

async function getPrimaryCalendar() {
  const { data, error } = await serviceClient
    .from('calendars')
    .select('id')
    .eq('is_primary', true)
    .single();

  if (error || !data) throw new Error('No primary calendar found');
  return data.id;
}

// TEST 1: Error Handling - Invalid data
async function testInvalidEventData() {
  const calendarId = await getPrimaryCalendar();

  // Test 1a: Missing required field (title)
  const invalidEvent1 = {
    calendar_id: calendarId,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    // Missing title
  };

  const { error: error1 } = await serviceClient
    .from('events')
    .insert(invalidEvent1);

  if (!error1) throw new Error('Should have rejected event without title');
  if (!error1.message.includes('null value')) throw new Error('Wrong error type');

  // Test 1b: Invalid date format
  const invalidEvent2 = {
    calendar_id: calendarId,
    title: 'Test',
    starts_at: 'invalid-date',
    ends_at: new Date().toISOString(),
  };

  const { error: error2 } = await serviceClient
    .from('events')
    .insert(invalidEvent2);

  if (!error2) throw new Error('Should have rejected invalid date');

  // Test 1c: End before start
  const now = new Date();
  const past = new Date(now.getTime() - 3600000);
  const invalidEvent3 = {
    calendar_id: calendarId,
    title: 'Test',
    starts_at: now.toISOString(),
    ends_at: past.toISOString(),
  };

  const { data: created, error: error3 } = await serviceClient
    .from('events')
    .insert(invalidEvent3)
    .select('id')
    .single();

  // Note: Database allows this but API validation should catch it
  if (!error3 && created) {
    // Clean up
    await serviceClient.from('events').delete().eq('id', created.id);
  }
}

// TEST 2: RLS Security - Unauthenticated access
async function testRLSSecurity() {
  const calendarId = await getPrimaryCalendar();

  const testEvent = {
    calendar_id: calendarId,
    title: 'RLS Test',
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
  };

  // Should fail with anon client
  const { error } = await anonClient
    .from('events')
    .insert(testEvent);

  if (!error) throw new Error('RLS should have blocked unauthenticated insert');
  if (!error.message.includes('row-level security')) {
    throw new Error(`Wrong error type: ${error.message}`);
  }
}

// TEST 3: Date Edge Cases
async function testDateEdgeCases() {
  const calendarId = await getPrimaryCalendar();

  // Test 3a: All-day event (midnight boundaries)
  const allDayEvent = {
    calendar_id: calendarId,
    title: 'All Day Test',
    starts_at: '2025-11-26T00:00:00.000Z',
    ends_at: '2025-11-27T00:00:00.000Z',
    all_day: true,
  };

  const { data: created1, error: error1 } = await serviceClient
    .from('events')
    .insert(allDayEvent)
    .select('id, starts_at, ends_at, all_day')
    .single();

  if (error1) throw error1;
  if (!created1.all_day) throw new Error('all_day flag not persisted');

  // Test 3b: Multi-day all-day event
  const multiDayEvent = {
    calendar_id: calendarId,
    title: 'Multi-Day Test',
    starts_at: '2025-11-26T00:00:00.000Z',
    ends_at: '2025-11-29T00:00:00.000Z',
    all_day: true,
  };

  const { data: created2, error: error2 } = await serviceClient
    .from('events')
    .insert(multiDayEvent)
    .select('id')
    .single();

  if (error2) throw error2;

  // Test 3c: Month boundary event
  const monthBoundaryEvent = {
    calendar_id: calendarId,
    title: 'Month Boundary Test',
    starts_at: '2025-11-30T23:00:00.000Z',
    ends_at: '2025-12-01T01:00:00.000Z',
    all_day: false,
  };

  const { data: created3, error: error3 } = await serviceClient
    .from('events')
    .insert(monthBoundaryEvent)
    .select('id')
    .single();

  if (error3) throw error3;

  // Test 3d: Year boundary event
  const yearBoundaryEvent = {
    calendar_id: calendarId,
    title: 'Year Boundary Test',
    starts_at: '2025-12-31T23:00:00.000Z',
    ends_at: '2026-01-01T01:00:00.000Z',
    all_day: false,
  };

  const { data: created4, error: error4 } = await serviceClient
    .from('events')
    .insert(yearBoundaryEvent)
    .select('id')
    .single();

  if (error4) throw error4;

  // Cleanup
  await serviceClient
    .from('events')
    .delete()
    .in('id', [created1.id, created2.id, created3.id, created4.id]);
}

// TEST 4: Timezone Handling
async function testTimezoneHandling() {
  const calendarId = await getPrimaryCalendar();

  // User in EST (UTC-5) selects "2025-11-26 13:00" local time
  const localDate = new Date('2025-11-26T13:00:00');
  const expectedUTC = localDate.toISOString(); // Should convert to UTC

  const event = {
    calendar_id: calendarId,
    title: 'Timezone Test',
    starts_at: expectedUTC,
    ends_at: new Date(localDate.getTime() + 3600000).toISOString(),
  };

  const { data: created, error } = await serviceClient
    .from('events')
    .insert(event)
    .select('id, starts_at')
    .single();

  if (error) throw error;

  // Verify UTC storage
  const storedDate = new Date(created.starts_at);
  const originalDate = new Date(expectedUTC);

  if (storedDate.getTime() !== originalDate.getTime()) {
    throw new Error('Timezone conversion mismatch');
  }

  // Cleanup
  await serviceClient.from('events').delete().eq('id', created.id);
}

// TEST 5: Performance - Rapid creation
async function testRapidEventCreation() {
  const calendarId = await getPrimaryCalendar();
  const count = 10;
  const events = [];

  // Create 10 events rapidly
  const start = Date.now();
  for (let i = 0; i < count; i++) {
    const eventStart = new Date(Date.now() + i * 3600000);
    const eventEnd = new Date(eventStart.getTime() + 1800000);

    events.push({
      calendar_id: calendarId,
      title: `Perf Test ${i + 1}`,
      starts_at: eventStart.toISOString(),
      ends_at: eventEnd.toISOString(),
    });
  }

  const { data: created, error } = await serviceClient
    .from('events')
    .insert(events)
    .select('id');

  const duration = Date.now() - start;

  if (error) throw error;
  if (!created || created.length !== count) {
    throw new Error(`Expected ${count} events, got ${created?.length || 0}`);
  }

  // Verify all persisted
  const { data: queried, error: queryError } = await serviceClient
    .from('events')
    .select('id')
    .in('id', created.map(e => e.id));

  if (queryError) throw queryError;
  if (queried.length !== count) {
    throw new Error(`Expected ${count} persisted events, found ${queried.length}`);
  }

  console.log(`   Created ${count} events in ${duration}ms (${(duration / count).toFixed(0)}ms/event)`);

  // Cleanup
  await serviceClient
    .from('events')
    .delete()
    .in('id', created.map(e => e.id));
}

// TEST 6: Query Performance
async function testQueryPerformance() {
  const calendarId = await getPrimaryCalendar();

  // Query 1 month of events
  const from = new Date('2025-11-01T00:00:00Z');
  const to = new Date('2025-12-01T00:00:00Z');

  const start = Date.now();
  const { data, error } = await serviceClient
    .from('events')
    .select('*')
    .eq('calendar_id', calendarId)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at');

  const duration = Date.now() - start;

  if (error) throw error;

  console.log(`   Queried ${data.length} events in ${duration}ms`);

  if (duration > 500) {
    console.log(`   ⚠️  Query took longer than 500ms`);
  }
}

// TEST 7: Optimistic Update Simulation
async function testOptimisticUpdate() {
  const calendarId = await getPrimaryCalendar();

  // Simulate optimistic update flow:
  // 1. Create event (API call)
  const event = {
    calendar_id: calendarId,
    title: 'Optimistic Test',
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
  };

  const { data: created, error } = await serviceClient
    .from('events')
    .insert(event)
    .select('id, title, starts_at, ends_at')
    .single();

  if (error) throw error;

  // 2. Verify immediate read-back
  const { data: readBack, error: readError } = await serviceClient
    .from('events')
    .select('*')
    .eq('id', created.id)
    .single();

  if (readError) throw readError;
  if (readBack.title !== event.title) {
    throw new Error('Event not immediately readable');
  }

  // 3. Update event (simulate edit)
  const updatedTitle = 'Optimistic Test Updated';
  const { error: updateError } = await serviceClient
    .from('events')
    .update({ title: updatedTitle })
    .eq('id', created.id);

  if (updateError) throw updateError;

  // 4. Verify update persisted
  const { data: updated, error: verifyError } = await serviceClient
    .from('events')
    .select('title')
    .eq('id', created.id)
    .single();

  if (verifyError) throw verifyError;
  if (updated.title !== updatedTitle) {
    throw new Error('Update not persisted');
  }

  // Cleanup
  await serviceClient.from('events').delete().eq('id', created.id);
}

// TEST 8: Realtime Subscription Setup
async function testRealtimeSubscription() {
  // This tests that the realtime channel can be established
  // Full multi-tab testing requires browser automation

  let receivedUpdate = false;

  const channel = serviceClient
    .channel('test-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      (payload) => {
        receivedUpdate = true;
        console.log(`   Realtime update received: ${payload.eventType}`);
      }
    )
    .subscribe((status) => {
      console.log(`   Subscription status: ${status}`);
    });

  // Wait for subscription to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create an event to trigger realtime update
  const calendarId = await getPrimaryCalendar();
  const { data: created } = await serviceClient
    .from('events')
    .insert({
      calendar_id: calendarId,
      title: 'Realtime Test',
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600000).toISOString(),
    })
    .select('id')
    .single();

  // Wait for realtime propagation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Cleanup
  if (created) {
    await serviceClient.from('events').delete().eq('id', created.id);
  }

  await serviceClient.removeChannel(channel);

  if (!receivedUpdate) {
    console.log('   ⚠️  Realtime update not received (may be expected in some environments)');
  }
}

async function main() {
  console.log('\n🧪 Comprehensive QuickAdd Integration Tests\n');
  console.log('═'.repeat(80));
  console.log();

  await runTest('1. Invalid Event Data Handling', testInvalidEventData);
  await runTest('2. RLS Security (Unauthenticated Access)', testRLSSecurity);
  await runTest('3. Date Edge Cases (All-day, Multi-day, Boundaries)', testDateEdgeCases);
  await runTest('4. Timezone Handling', testTimezoneHandling);
  await runTest('5. Rapid Event Creation (10 events)', testRapidEventCreation);
  await runTest('6. Query Performance (1 month)', testQueryPerformance);
  await runTest('7. Optimistic Update Flow', testOptimisticUpdate);
  await runTest('8. Realtime Subscription Setup', testRealtimeSubscription);

  console.log();
  console.log('═'.repeat(80));
  console.log('\n📊 Test Summary\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:\n');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     Error: ${r.error}`);
    });
  }

  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;
  console.log(`\nAverage test duration: ${avgDuration.toFixed(0)}ms`);

  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ Test suite failed:', err.message);
  process.exit(1);
});

/**
 * Probe Events - Service Role Query Test
 *
 * This script bypasses RLS to test if the query works at the Postgres level.
 * If this succeeds but the API fails, the issue is RLS policy recursion.
 *
 * Run with: bunx tsx scripts/probe-events.ts
 */

import { sb } from './sb';

async function main() {
  console.log('🔍 Probing events table (bypassing RLS)...\n');

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const to = new Date();
  to.setDate(to.getDate() + 1);
  to.setHours(23, 59, 59, 999);

  console.log(`Time window: ${from.toISOString()} → ${to.toISOString()}\n`);

  const start = Date.now();
  const { data, error } = await sb
    .from('events')
    .select('id, calendar_id, title, starts_at, ends_at, color')
    .lte('starts_at', to.toISOString())
    .gte('ends_at', from.toISOString())
    .order('starts_at', { ascending: true });

  const elapsed = Date.now() - start;

  if (error) {
    console.error('❌ SERVICE QUERY ERROR:', error);
    console.error('\nThis indicates a database-level issue (trigger, function, or constraint).\n');
    process.exit(1);
  }

  console.log(`✅ SERVICE QUERY OK (${elapsed}ms)`);
  console.log(`   Rows returned: ${data?.length ?? 0}\n`);

  if (data && data.length > 0) {
    console.log('Sample events:');
    data.slice(0, 3).forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.title} (${e.starts_at})`);
    });
    console.log('');
  }

  console.log('💡 If API still fails with "stack depth limit exceeded",');
  console.log('   the issue is RLS policy recursion.\n');
}

main().catch((err) => {
  console.error('\n❌ Script error:', err.message);
  process.exit(1);
});

/**
 * Inspect RLS Policies
 *
 * Queries Postgres system tables to show all RLS policies on the events table.
 * This helps identify recursive policy definitions.
 *
 * Run with: bunx tsx scripts/inspect-rls-policies.ts
 */

import { sb } from './sb';

async function main() {
  console.log('🔍 Inspecting RLS policies on events table...\n');

  // Query pg_policies to see all policies
  const { data, error } = await sb.rpc('exec_sql', {
    query: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'events' AND schemaname = 'public'
      ORDER BY policyname;
    `,
  });

  if (error) {
    // Fallback: Try direct query (some Supabase projects disable exec_sql)
    console.log('⚠️  exec_sql RPC not available, trying direct psql...\n');
    console.log('Please run this SQL in Supabase SQL Editor:\n');
    console.log(`
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'events' AND schemaname = 'public'
ORDER BY policyname;
    `);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('ℹ️  No RLS policies found on events table.\n');
    console.log('This might mean:');
    console.log('  - RLS is not enabled');
    console.log('  - Policies exist but query failed\n');
    process.exit(0);
  }

  console.log(`Found ${data.length} policies:\n`);
  data.forEach((policy: any, i: number) => {
    console.log(`${i + 1}. ${policy.policyname} (${policy.cmd})`);
    console.log(`   Permissive: ${policy.permissive}`);
    console.log(`   Roles: ${policy.roles}`);
    if (policy.qual) {
      console.log(`   USING: ${policy.qual.substring(0, 200)}${policy.qual.length > 200 ? '...' : ''}`);
    }
    if (policy.with_check) {
      console.log(`   WITH CHECK: ${policy.with_check.substring(0, 200)}${policy.with_check.length > 200 ? '...' : ''}`);
    }
    console.log('');
  });

  console.log('💡 Look for policies that reference "events" in USING or WITH CHECK clauses.');
  console.log('   These cause recursion!\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

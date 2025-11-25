#!/usr/bin/env tsx
/**
 * Comprehensive RLS Diagnostics for Stack Depth Error
 *
 * This script:
 * 1. Queries the database to see current RLS policies on events table
 * 2. Identifies which policies reference the events table (recursive)
 * 3. Tests service role query (bypassing RLS)
 * 4. Shows the exact policy definitions
 */

import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

console.log('🔍 Diagnosing RLS Policy Recursion\n');
console.log('═'.repeat(80));

// Test 1: Query pg_policies to see all RLS policies
async function inspectPolicies() {
  console.log('\n📋 STEP 1: Inspecting current RLS policies on events table\n');

  const query = `
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
  `;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      // Try PostgREST query instead
      const pgQuery = encodeURIComponent(`
        schemaname.eq.public,tablename.eq.events
      `);

      console.log('   Using direct Supabase query to inspect policies...\n');

      // Query using service role directly
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

      const { data, error } = await supabase.rpc('exec_sql', {
        query: `
          SELECT
            policyname,
            cmd,
            qual::text as using_clause,
            with_check::text as with_check_clause
          FROM pg_policies
          WHERE tablename = 'events' AND schemaname = 'public'
          ORDER BY policyname;
        `
      });

      if (error) {
        console.error('   ⚠️  Could not query pg_policies via RPC');
        console.error('   This is expected - Supabase may not have exec_sql RPC enabled\n');
        return null;
      }

      return data;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('   ⚠️  Could not inspect policies via API');
    console.error('   Reason:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Test 2: Service role query (bypasses RLS)
async function testServiceRole() {
  console.log('\n📋 STEP 2: Testing service role query (bypasses RLS)\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  const from = new Date('2025-10-15T00:00:00.000Z');
  const to = new Date('2025-10-16T23:59:59.999Z');

  const start = Date.now();

  const { data, error } = await supabase
    .from('events')
    .select('id, calendar_id, title, starts_at, ends_at, color')
    .lte('starts_at', to.toISOString())
    .gte('ends_at', from.toISOString())
    .order('starts_at', { ascending: true });

  const elapsed = Date.now() - start;

  if (error) {
    console.log(`   ❌ SERVICE QUERY FAILED (${elapsed}ms)`);
    console.log(`   Error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ SERVICE QUERY OK (${elapsed}ms)`);
  console.log(`   Rows returned: ${data?.length || 0}`);

  if (data && data.length > 0) {
    console.log(`   Sample event: ${data[0].title}`);
  }

  return true;
}

// Test 3: Regular API query (uses RLS)
async function testAPIRoute() {
  console.log('\n📋 STEP 3: Testing API route (with RLS enabled)\n');

  const url = 'http://localhost:3000/api/events?from=2025-10-15T00:00:00.000Z&to=2025-10-16T23:59:59.999Z';

  const start = Date.now();

  try {
    const response = await fetch(url);
    const elapsed = Date.now() - start;

    if (!response.ok) {
      const text = await response.text();
      const json = JSON.parse(text);

      console.log(`   ❌ API QUERY FAILED (${elapsed}ms)`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${json.error}`);
      console.log(`   Details: ${json.details}`);

      if (json.details && json.details.includes('stack depth limit exceeded')) {
        console.log('\n   ⚠️  CONFIRMED: RLS policy recursion detected!');
      }

      return false;
    }

    const json = await response.json();
    console.log(`   ✅ API QUERY OK (${elapsed}ms)`);
    console.log(`   Events returned: ${json.events?.length || 0}`);
    return true;

  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ API QUERY FAILED (${elapsed}ms)`);
    console.log(`   Error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// Test 4: Query actual policy definitions using raw SQL
async function showPolicyDefinitions() {
  console.log('\n📋 STEP 4: Fetching actual policy definitions\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  // Query using a raw SQL approach via Supabase
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(0); // We don't need data, just want to trigger any policy issues

  // Try to get policy info from information_schema
  console.log('   Attempting to retrieve policy definitions...\n');
  console.log('   ⚠️  Note: Policy definitions can only be viewed in Supabase Dashboard');
  console.log('   Location: Database → Policies → events table\n');
}

// Main diagnostic flow
async function main() {
  try {
    // Step 1: Try to inspect policies
    const policies = await inspectPolicies();

    if (policies && Array.isArray(policies) && policies.length > 0) {
      console.log(`   Found ${policies.length} policies:\n`);

      policies.forEach((policy: any) => {
        console.log(`   Policy: ${policy.policyname}`);
        console.log(`   Command: ${policy.cmd}`);

        const usingClause = policy.using_clause || policy.qual || '';
        const withCheckClause = policy.with_check_clause || policy.with_check || '';

        // Check for recursion
        const hasRecursion =
          usingClause.toLowerCase().includes('events') ||
          withCheckClause.toLowerCase().includes('events');

        if (hasRecursion) {
          console.log(`   🚨 RECURSIVE! References "events" table`);
        } else {
          console.log(`   ✅ Safe (no recursion)`);
        }

        console.log('');
      });
    }

    // Step 2: Test service role
    const serviceOk = await testServiceRole();

    // Step 3: Test API route
    const apiOk = await testAPIRoute();

    // Step 4: Show where to find policies
    await showPolicyDefinitions();

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 DIAGNOSTIC SUMMARY\n');

    if (serviceOk && !apiOk) {
      console.log('✅ Service role query: WORKS (no RLS)');
      console.log('❌ API route query: FAILS (with RLS)');
      console.log('\n🎯 DIAGNOSIS: RLS policy recursion on events table');
      console.log('\n💡 SOLUTION: Apply FIX_RLS_RECURSION.sql in Supabase SQL Editor');
      console.log('   Location: fixes/stack-depth-rls-recursion/FIX_RLS_RECURSION.sql');
    } else if (serviceOk && apiOk) {
      console.log('✅ Service role query: WORKS');
      console.log('✅ API route query: WORKS');
      console.log('\n🎉 No RLS issues detected! Everything is working.');
    } else {
      console.log('❌ Service role query: FAILED');
      console.log('❌ API route query: FAILED');
      console.log('\n⚠️  This may indicate a different issue (not RLS recursion)');
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Diagnostic error:', error);
    process.exit(1);
  }
}

main();

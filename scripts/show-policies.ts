#!/usr/bin/env tsx
/**
 * Show RLS Policies on Events Table
 * Uses PostgREST to query pg_policies system catalog
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

async function main() {
  console.log('🔍 Querying RLS policies on events table...\n');

  try {
    // Try to query pg_policies view directly
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/pg_policies?tablename=eq.events&schemaname=eq.public&select=policyname,cmd,qual,with_check`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.log('⚠️  Cannot query pg_policies via REST API');
      console.log('This is normal - system catalogs are not exposed via PostgREST\n');

      console.log('📋 You need to check policies manually in Supabase Dashboard:');
      console.log('   1. Go to: https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Go to: Database → Policies');
      console.log('   4. Find the "events" table');
      console.log('   5. Look for any policy where the USING clause mentions "events"\n');

      console.log('🔧 To fix immediately:');
      console.log('   1. Open: https://supabase.com/dashboard/project/ibjulgjncqjvggldmkmq/sql/new');
      console.log('   2. Copy the SQL from: fixes/stack-depth-rls-recursion/FIX_RLS_RECURSION.sql');
      console.log('   3. Paste and click Run\n');

      return;
    }

    const policies = await response.json();

    if (policies && policies.length > 0) {
      console.log(`Found ${policies.length} RLS policies:\n`);

      policies.forEach((policy: any) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Policy: ${policy.policyname}`);
        console.log(`Command: ${policy.cmd}`);
        console.log(`\nUSING clause:`);
        console.log(policy.qual || '(none)');

        if (policy.with_check) {
          console.log(`\nWITH CHECK clause:`);
          console.log(policy.with_check);
        }

        // Check for recursion
        const usingClause = (policy.qual || '').toLowerCase();
        const withCheckClause = (policy.with_check || '').toLowerCase();

        if (usingClause.includes('events') || withCheckClause.includes('events')) {
          console.log(`\n🚨 RECURSIVE! This policy references the "events" table`);
        } else {
          console.log(`\n✅ Safe (no recursion)`);
        }

        console.log('');
      });
    } else {
      console.log('No policies found on events table');
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

main();

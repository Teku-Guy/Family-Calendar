#!/usr/bin/env tsx
/**
 * Fix RLS Policy Recursion on Events Table
 *
 * This script applies the fix for "stack depth limit exceeded" error
 * by replacing recursive RLS policies with safe membership-based policies.
 *
 * Run: bunx tsx scripts/fix-rls-policies.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { Client } from 'pg';

// Load environment variables from .env.local
config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!DB_PASSWORD) {
  console.error('\n❌ Missing SUPABASE_DB_PASSWORD in .env.local');
  console.error('\n📋 To get your database password:');
  console.error('   1. Go to https://supabase.com/dashboard');
  console.error('   2. Select your project');
  console.error('   3. Go to Settings → Database');
  console.error('   4. Copy the password or reset it');
  console.error('   5. Add to .env.local: SUPABASE_DB_PASSWORD=your_password');
  console.error('\n💡 OR run the SQL manually in Supabase SQL Editor:');
  console.error('   Open: FIX_RLS_RECURSION.sql');
  process.exit(1);
}

// Parse Supabase URL to get database host
// Example: https://ibjulgjncqjvggldmkmq.supabase.co → db.ibjulgjncqjvggldmkmq.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;

console.log('🔧 Fixing RLS policies on events table...\n');

async function main() {
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('   ✅ Connected\n');

    // Step 1: Drop all existing policies
    console.log('📋 Step 1: Dropping existing policies...');

    const policiesToDrop = [
      'events_select_membership',
      'events_insert_membership',
      'events_update_membership',
      'events_delete_membership',
      'events_all_membership',
      'Enable read access for authenticated users',
      'Enable insert for authenticated users',
      'Enable update for users based on calendar_id',
      'Enable delete for users based on calendar_id',
    ];

    for (const policy of policiesToDrop) {
      await client.query(`DROP POLICY IF EXISTS "${policy}" ON public.events;`);
      console.log(`   ✅ Dropped: ${policy}`);
    }

    // Step 2: Enable RLS
    console.log('\n📋 Step 2: Ensuring RLS is enabled...');
    await client.query('ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;');
    console.log('   ✅ RLS enabled\n');

    // Step 3: Create safe policies
    console.log('📋 Step 3: Creating safe, non-recursive policies...');

    // SELECT policy
    await client.query(`
      CREATE POLICY events_select_membership
      ON public.events
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id
            AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✅ Created: events_select_membership');

    // INSERT policy
    await client.query(`
      CREATE POLICY events_insert_membership
      ON public.events
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id
            AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✅ Created: events_insert_membership');

    // UPDATE policy
    await client.query(`
      CREATE POLICY events_update_membership
      ON public.events
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id
            AND fm.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id
            AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✅ Created: events_update_membership');

    // DELETE policy
    await client.query(`
      CREATE POLICY events_delete_membership
      ON public.events
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id
            AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✅ Created: events_delete_membership');

    console.log('\n✅ RLS policies fixed successfully!');
    console.log('\n📝 What changed:');
    console.log('  • Dropped all recursive policies that referenced events table');
    console.log('  • Created safe membership-based policies');
    console.log('  • Policies now only join calendars + family_members (no recursion)');

    console.log('\n🧪 Verify the fix:');
    console.log('  curl -s \'http://localhost:3000/api/events?from=2025-10-15T00:00:00.000Z&to=2025-10-16T23:59:59.999Z\' | jq');
    console.log('  (Should return events without "stack depth limit exceeded" error)\n');

  } catch (error) {
    console.error('\n❌ Error applying fix:', error);
    console.error('\n💡 Alternative: Run FIX_RLS_RECURSION.sql in Supabase SQL Editor');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

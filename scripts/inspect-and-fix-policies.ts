#!/usr/bin/env tsx
/**
 * Inspect and Fix RLS Policies
 * Connects directly to Postgres to view and fix policies
 */

import { config } from 'dotenv';
import { join } from 'path';
import { Client } from 'pg';

config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Missing required environment variables');
  console.error('   Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
const dbHost = `aws-0-us-west-1.pooler.supabase.com`;

async function main() {
  const client = new Client({
    host: dbHost,
    port: 6543, // Use connection pooler port
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Query current policies
    console.log('📋 Current RLS policies on events table:\n');

    const result = await client.query(`
      SELECT
        policyname,
        cmd,
        qual::text as using_clause,
        with_check::text as with_check_clause
      FROM pg_policies
      WHERE tablename = 'events' AND schemaname = 'public'
      ORDER BY policyname;
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No policies found on events table\n');
    } else {
      result.rows.forEach((row) => {
        console.log('━'.repeat(80));
        console.log(`Policy: ${row.policyname}`);
        console.log(`Command: ${row.cmd}`);
        console.log(`\nUSING clause:`);
        console.log(row.using_clause || '(none)');

        if (row.with_check_clause) {
          console.log(`\nWITH CHECK clause:`);
          console.log(row.with_check_clause);
        }

        // Check for recursion
        const hasRecursion =
          (row.using_clause || '').toLowerCase().includes('events') ||
          (row.with_check_clause || '').toLowerCase().includes('events');

        if (hasRecursion) {
          console.log(`\n🚨 RECURSIVE! References "events" table → CAUSES STACK OVERFLOW`);
        } else {
          console.log(`\n✅ Safe (no recursion)`);
        }

        console.log('');
      });
    }

    // Ask to apply fix
    console.log('━'.repeat(80));
    console.log('\n🔧 Ready to apply fix?\n');
    console.log('The fix will:');
    console.log('  1. Drop all existing policies');
    console.log('  2. Create 4 safe, non-recursive policies');
    console.log('  3. Fix the "stack depth limit exceeded" error\n');

    // Apply fix automatically
    console.log('Applying fix in 2 seconds... (press Ctrl+C to cancel)\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🔧 Applying fix...\n');

    // Drop existing policies
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
      console.log(`   ✓ Dropped: ${policy}`);
    }

    // Enable RLS
    await client.query('ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;');
    console.log('\n   ✓ RLS enabled\n');

    // Create safe policies
    console.log('Creating safe policies...\n');

    await client.query(`
      CREATE POLICY events_select_membership ON public.events FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✓ Created: events_select_membership');

    await client.query(`
      CREATE POLICY events_insert_membership ON public.events FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✓ Created: events_insert_membership');

    await client.query(`
      CREATE POLICY events_update_membership ON public.events FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id AND fm.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✓ Created: events_update_membership');

    await client.query(`
      CREATE POLICY events_delete_membership ON public.events FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.calendars c
          JOIN public.family_members fm ON fm.family_id = c.family_id
          WHERE c.id = events.calendar_id AND fm.user_id = auth.uid()
        )
      );
    `);
    console.log('   ✓ Created: events_delete_membership');

    console.log('\n✅ Fix applied successfully!\n');

    // Verify
    console.log('━'.repeat(80));
    console.log('\n🧪 Verifying fix...\n');

    const verifyResult = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE tablename = 'events' AND schemaname = 'public'
      ORDER BY policyname;
    `);

    console.log(`Found ${verifyResult.rows.length} policies:\n`);
    verifyResult.rows.forEach(row => {
      console.log(`   ✓ ${row.policyname} (${row.cmd})`);
    });

    console.log('\n━'.repeat(80));
    console.log('\n🎉 Success! Test your API now:\n');
    console.log('   curl -s \'http://localhost:3000/api/events?from=2025-10-15T00:00:00.000Z&to=2025-10-16T23:59:59.999Z\' | jq\n');

  } catch (error) {
    console.error('\n❌ Error:', error);

    if (error instanceof Error && error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Could not connect to database');
      console.error('   Try applying the fix manually in Supabase SQL Editor:');
      console.error('   Location: fixes/stack-depth-rls-recursion/FIX_RLS_RECURSION.sql\n');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

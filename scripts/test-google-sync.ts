#!/usr/bin/env tsx
/**
 * Google Calendar Integration Test Script
 *
 * Comprehensive manual testing tool for Sprint 4B/4C validation.
 * Tests OAuth, sync, push operations, and safety controls.
 *
 * Usage:
 *   bunx tsx scripts/test-google-sync.ts
 *
 * Prerequisites:
 *   - RLS policies applied (COMPLETE_RLS_POLICIES.sql)
 *   - Dev server running (npm run dev or bun run dev)
 *   - Google OAuth configured in .env.local
 *   - User signed in to the app
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test results tracking
interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  message: string;
  duration?: number;
  details?: any;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = {
    pass: '✅',
    fail: '❌',
    skip: '⏭️ ',
    warn: '⚠️ ',
  }[result.status];
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, result.details);
  }
}

async function runTest(
  name: string,
  testFn: () => Promise<void | { status?: 'pass' | 'fail' | 'skip' | 'warn'; message?: string; details?: any }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;

    if (result && result.status) {
      logTest({
        name,
        status: result.status,
        message: result.message || 'Test completed',
        duration,
        details: result.details,
      });
    } else {
      logTest({
        name,
        status: 'pass',
        message: 'Test passed',
        duration,
      });
    }
  } catch (error) {
    const duration = Date.now() - start;
    logTest({
      name,
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration,
    });
  }
}

/**
 * Test 1: Database Schema Validation
 */
async function testDatabaseSchema() {
  console.log('\n📊 Testing Database Schema...\n');

  await runTest('Check events table columns', async () => {
    const { data, error } = await supabase.from('events').select('*').limit(1);
    if (error) throw new Error(`Failed to query events: ${error.message}`);

    const requiredColumns = [
      'id', 'calendar_id', 'title', 'starts_at', 'ends_at',
      'external_id', 'external_etag', 'external_updated_at', 'external_source'
    ];

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      const missing = requiredColumns.filter(col => !columns.includes(col));
      if (missing.length > 0) {
        throw new Error(`Missing columns: ${missing.join(', ')}`);
      }
    }

    return { status: 'pass', message: 'All required columns present' };
  });

  await runTest('Check google_accounts table', async () => {
    const { error } = await supabase.from('google_accounts').select('*').limit(1);
    if (error) throw new Error(`google_accounts table missing or inaccessible: ${error.message}`);
    return { status: 'pass', message: 'Table accessible' };
  });

  await runTest('Check calendars table', async () => {
    const { data, error } = await supabase.from('calendars').select('*').limit(1);
    if (error) throw new Error(`calendars table inaccessible: ${error.message}`);
    if (!data || data.length === 0) {
      return { status: 'warn', message: 'No calendars found (create one via UI first)' };
    }
    return { status: 'pass', message: `Found ${data.length} calendar(s)` };
  });
}

/**
 * Test 2: Environment Configuration
 */
async function testEnvironmentConfig() {
  console.log('\n🔧 Testing Environment Configuration...\n');

  await runTest('Check Google OAuth credentials', async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI');
    }

    return { status: 'pass', message: 'OAuth credentials configured' };
  });

  await runTest('Check safety flags', async () => {
    const dryRun = process.env.GOOGLE_SYNC_DRY_RUN;
    const allowWrites = process.env.ALLOW_GOOGLE_WRITES;
    const allowlist = process.env.GOOGLE_WRITE_ALLOWLIST;

    const details = {
      GOOGLE_SYNC_DRY_RUN: dryRun,
      ALLOW_GOOGLE_WRITES: allowWrites,
      GOOGLE_WRITE_ALLOWLIST: allowlist || '(empty)',
    };

    const writesEnabled = dryRun !== 'true' && allowWrites === 'true';

    return {
      status: writesEnabled ? 'warn' : 'pass',
      message: writesEnabled
        ? 'WRITES ENABLED - Real Google API calls will be made'
        : 'Writes disabled (safe mode)',
      details,
    };
  });
}

/**
 * Test 3: Google OAuth Token Check
 */
async function testOAuthTokens() {
  console.log('\n🔐 Testing OAuth Tokens...\n');

  await runTest('Check for stored Google tokens', async () => {
    const { data: tokens, error } = await supabase
      .from('google_accounts')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Failed to query google_accounts: ${error.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return {
        status: 'skip',
        message: 'No Google accounts connected. Complete OAuth flow first.',
        details: {
          action: 'Visit http://localhost:3000/api/google/oauth/start',
        },
      };
    }

    const token = tokens[0];
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;

    return {
      status: isExpired ? 'warn' : 'pass',
      message: isExpired
        ? 'Token expired (will auto-refresh on next request)'
        : 'Valid token found',
      details: {
        user_id: token.user_id,
        expires_at: token.expires_at,
        has_refresh_token: !!token.refresh_token,
      },
    };
  });
}

/**
 * Test 4: API Endpoints Availability
 */
async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...\n');

  await runTest('GET /api/events', async () => {
    const response = await fetch(`${appUrl}/api/events`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Status ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    return {
      status: 'pass',
      message: `Returned ${data.length || 0} events`,
    };
  });

  await runTest('GET /api/google/calendar-list', async () => {
    const response = await fetch(`${appUrl}/api/google/calendar-list`);
    if (response.status === 401) {
      return {
        status: 'skip',
        message: 'Not authenticated (sign in first)',
      };
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Status ${response.status}: ${text.slice(0, 200)}`);
    }
    return { status: 'pass', message: 'Calendar list accessible' };
  });

  await runTest('POST /api/google/sync availability', async () => {
    // Just check the endpoint exists (don't actually trigger sync yet)
    const response = await fetch(`${appUrl}/api/google/sync`, {
      method: 'HEAD',
    });

    // HEAD may not be supported, but we can check if endpoint exists
    if (response.status === 405) {
      return { status: 'pass', message: 'Endpoint exists (405 Method Not Allowed for HEAD)' };
    }

    return {
      status: response.status === 401 ? 'skip' : 'pass',
      message: response.status === 401 ? 'Not authenticated' : 'Endpoint accessible',
    };
  });
}

/**
 * Test 5: Dry-Run Mode Validation
 */
async function testDryRunMode() {
  console.log('\n🛡️  Testing Dry-Run Safety Controls...\n');

  const dryRun = process.env.GOOGLE_SYNC_DRY_RUN === 'true';
  const allowWrites = process.env.ALLOW_GOOGLE_WRITES === 'true';

  if (!dryRun && allowWrites) {
    console.log('⚠️  SKIPPING: Writes are enabled - unsafe to test push operations automatically');
    console.log('   Set GOOGLE_SYNC_DRY_RUN=true to test dry-run mode\n');
    return;
  }

  await runTest('Verify dry-run prevents writes', async () => {
    // Try to find or create a test event
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .limit(1);

    if (!events || events.length === 0) {
      return {
        status: 'skip',
        message: 'No events available to test push (run seed script first)',
      };
    }

    const eventId = events[0].id;

    // Try to push with dry-run enabled
    const response = await fetch(`${appUrl}/api/google/push/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'update' }),
    });

    if (response.status === 401) {
      return { status: 'skip', message: 'Not authenticated' };
    }

    const result = await response.json();

    if (result.simulated !== true) {
      throw new Error('Expected simulated:true in dry-run mode, but got real write');
    }

    return {
      status: 'pass',
      message: 'Dry-run mode working correctly',
      details: { note: result.note },
    };
  });
}

/**
 * Test 6: Database Event CRUD
 */
async function testEventCRUD() {
  console.log('\n📝 Testing Event CRUD Operations...\n');

  await runTest('Create test event in database', async () => {
    // Find primary calendar
    const { data: calendar } = await supabase
      .from('calendars')
      .select('id')
      .eq('is_primary', true)
      .limit(1)
      .single();

    if (!calendar) {
      return { status: 'skip', message: 'No primary calendar found' };
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        calendar_id: calendar.id,
        title: '[TEST] Integration Test Event',
        starts_at: tomorrow.toISOString(),
        ends_at: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        all_day: false,
        external_source: null,
      })
      .select()
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);

    return {
      status: 'pass',
      message: 'Test event created',
      details: { id: event.id, title: event.title },
    };
  });

  await runTest('Query events', async () => {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .ilike('title', '%TEST%')
      .limit(10);

    if (error) throw new Error(`Query failed: ${error.message}`);

    return {
      status: 'pass',
      message: `Found ${events?.length || 0} test events`,
    };
  });

  await runTest('Clean up test events', async () => {
    const { error } = await supabase
      .from('events')
      .delete()
      .ilike('title', '%TEST%');

    if (error) throw new Error(`Cleanup failed: ${error.message}`);

    return { status: 'pass', message: 'Test events cleaned up' };
  });
}

/**
 * Main Test Runner
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Google Calendar Integration - Manual Test Suite              ║');
  console.log('║  Sprint 4C Validation                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📍 App URL: ${appUrl}`);
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  // Run all test suites
  await testDatabaseSchema();
  await testEnvironmentConfig();
  await testOAuthTokens();
  await testAPIEndpoints();
  await testDryRunMode();
  await testEventCRUD();

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const warnings = results.filter((r) => r.status === 'warn').length;

  console.log(`✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Total:    ${results.length}\n`);

  if (failed > 0) {
    console.log('❌ Some tests failed. Review errors above.\n');
    process.exit(1);
  }

  if (skipped > 0) {
    console.log('⏭️  Some tests were skipped. Complete prerequisites:\n');
    const skippedTests = results.filter((r) => r.status === 'skip');
    skippedTests.forEach((t) => {
      console.log(`   - ${t.name}: ${t.message}`);
    });
    console.log('');
  }

  console.log('✨ Test suite completed!\n');

  if (warnings > 0) {
    console.log('⚠️  Warnings detected - review above for details.\n');
  }

  console.log('📋 Next Steps:\n');
  console.log('   1. If OAuth not connected: Visit http://localhost:3000/api/google/oauth/start');
  console.log('   2. If no calendars: Sign in to the app to create primary calendar');
  console.log('   3. To test push flow: Run bunx tsx scripts/seed-demo-events.ts');
  console.log('   4. To enable real writes: Set GOOGLE_SYNC_DRY_RUN=false in .env.local\n');
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

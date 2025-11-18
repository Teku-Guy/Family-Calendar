#!/usr/bin/env tsx
/**
 * Environment Health Check
 * Verifies all required environment variables are set
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:');
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error('\n💡 Set these in .env.local');
  process.exit(1);
}

const prefix = (s?: string) => (s ? s.slice(0, 8) + '…' : '—');

console.log('✅ Environment check passed\n');
console.log('[env] URL =', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[env] ANON key prefix =', prefix(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
console.log('[env] SVC  key prefix =', prefix(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log('');

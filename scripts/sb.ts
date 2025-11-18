/**
 * Supabase client for server-side scripts
 *
 * WARNING: This uses the service role key and bypasses RLS.
 * NEVER import this in client-side code. Only use in local scripts.
 */

// Load .env.local before any other imports
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean).join(', ');
  throw new Error(`Missing env: ${missing}. Check .env.local and re-run.`);
}

// Create Supabase client with service role (bypasses RLS)
export const sb = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Diagnostic output when run directly
if (require.main === module) {
  console.log('[sb] URL:', url);
  console.log('[sb] Service key prefix:', serviceKey.slice(0, 8) + '…');
  console.log('[sb] Client initialized successfully');
}

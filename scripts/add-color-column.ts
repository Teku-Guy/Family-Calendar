/**
 * Add color column to events table
 *
 * This script adds the `color` column to the events table if it doesn't exist.
 * Run with: bunx tsx scripts/add-color-column.ts
 */

import { sb } from './sb';

async function main() {
  console.log('Adding color column to events table...\n');

  // Use raw SQL to add column if not exists
  const { error } = await sb.rpc('exec_sql', {
    sql: `
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
    `,
  });

  if (error) {
    // If RPC doesn't exist, try direct SQL
    const { error: sqlError } = await sb.from('events').select('color').limit(1);

    if (sqlError && sqlError.message.includes('column')) {
      console.log('⚠️  Column does not exist. Creating via manual SQL...\n');
      console.log('Please run this SQL in your Supabase SQL Editor:\n');
      console.log('ALTER TABLE events ADD COLUMN color TEXT DEFAULT \'#3b82f6\';\n');
      process.exit(1);
    }
  }

  console.log('✅ Color column added successfully!\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

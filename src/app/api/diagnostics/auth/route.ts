/**
 * Auth Diagnostics Endpoint
 *
 * Returns diagnostic information about the authentication configuration,
 * including which environment variables are present and computed callback URLs.
 *
 * This endpoint helps developers quickly identify configuration issues like:
 * - Missing environment variables
 * - Incorrect redirect URI configuration
 * - Provider enablement status
 */

import { NextResponse } from 'next/server';

/**
 * Masks a sensitive string, showing only first/last 4 characters
 */
function maskSensitive(value: string | undefined): string {
  if (!value) return 'NOT_SET';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
  const diagnostics = {
    ok: true,
    timestamp: new Date().toISOString(),
    environment: {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: maskSensitive(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),

      // Google OAuth
      GOOGLE_CLIENT_ID: maskSensitive(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: maskSensitive(process.env.GOOGLE_CLIENT_SECRET),

      // App URL
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',

      // Encryption
      ENCRYPTION_SECRET: maskSensitive(process.env.ENCRYPTION_SECRET),
    },
    computed: {
      // Supabase Auth callback (for Google Sign-In via Supabase)
      supabaseAuthCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,

      // Google Calendar OAuth callback (separate flow)
      googleCalendarCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/oauth/callback`,
    },
    warnings: [] as string[],
  };

  // Check for missing critical env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'NOT_SET') {
    diagnostics.ok = false;
    diagnostics.warnings.push('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    diagnostics.ok = false;
    diagnostics.warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    diagnostics.warnings.push('GOOGLE_CLIENT_ID is not set (required for Google Calendar sync)');
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    diagnostics.warnings.push('GOOGLE_CLIENT_SECRET is not set (required for Google Calendar sync)');
  }

  if (!process.env.ENCRYPTION_SECRET) {
    diagnostics.warnings.push('ENCRYPTION_SECRET is not set (required for token encryption)');
  }

  // Add helpful hints
  if (diagnostics.warnings.length > 0) {
    diagnostics.warnings.push('');
    diagnostics.warnings.push('Common fixes:');
    diagnostics.warnings.push('1. Enable Google provider in Supabase Dashboard → Authentication → Providers');
    diagnostics.warnings.push('2. Add authorized redirect URIs in Google Cloud Console:');
    diagnostics.warnings.push(`   - ${diagnostics.computed.supabaseAuthCallback}`);
    diagnostics.warnings.push(`   - ${diagnostics.computed.googleCalendarCallback}`);
    diagnostics.warnings.push('3. Copy .env.local.example to .env.local and fill in all values');
    diagnostics.warnings.push('4. Generate ENCRYPTION_SECRET with: openssl rand -hex 32');
  }

  return NextResponse.json(diagnostics);
}

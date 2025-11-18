/**
 * Environment diagnostics endpoint
 *
 * Returns presence/absence of critical environment variables
 * Useful for debugging configuration issues
 *
 * Usage: GET /api/diagnostics/env
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const present = (v?: string) => (v ? 'set' : 'missing');

  return NextResponse.json({
    // Supabase config
    NEXT_PUBLIC_SUPABASE_URL: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),

    // Google OAuth
    GOOGLE_CLIENT_ID: present(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: present(process.env.GOOGLE_CLIENT_SECRET),
    GOOGLE_REDIRECT_URI: present(process.env.GOOGLE_REDIRECT_URI),

    // App config
    DEVICE_JWT_SECRET: present(process.env.DEVICE_JWT_SECRET),
    PUBLIC_BASE_URL: present(process.env.PUBLIC_BASE_URL),
    NODE_ENV: process.env.NODE_ENV || 'unknown',
  });
}

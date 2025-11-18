import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
// Updated for Sprint 4B: Two-way sync requires write access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events', // Read and write access to events
].join(' ');

export async function GET() {
  try {
    // Ensure user is authenticated
    const sb = await supabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
        { status: 500 }
      );
    }

    // Build OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/oauth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: user.id, // Pass user ID for validation in callback
    });

    const authUrl = `${GOOGLE_OAUTH_URL}?${params.toString()}`;

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (e) {
    console.error('GET /api/google/oauth/start error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

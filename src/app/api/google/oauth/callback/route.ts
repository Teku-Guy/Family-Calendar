import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user ID
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=${error}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=missing_params`);
    }

    // Verify user is authenticated
    const sb = await supabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();

    if (authError || !user || user.id !== state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=unauthorized`);
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/oauth/callback`;

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token || !refresh_token) {
      console.error('Missing tokens in response:', tokens);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=missing_tokens`);
    }

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(access_token);
    const encryptedRefreshToken = await encrypt(refresh_token);

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert to google_accounts table
    const { error: dbError } = await sb
      .from('google_accounts')
      .upsert({
        user_id: user.id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('Failed to save Google tokens:', dbError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=db_error`);
    }

    // Success! Redirect to calendar with success message
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_connected=true`);
  } catch (e) {
    console.error('GET /api/google/oauth/callback error:', e);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?google_error=server_error`);
  }
}

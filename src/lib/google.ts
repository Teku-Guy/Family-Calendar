import { supabaseServer } from './supabase/server';
import { encrypt, decrypt } from './crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GoogleAccount {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
}

/**
 * Gets a valid access token for the current user, refreshing if needed
 */
async function getAccessToken(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data: { user }, error: authError } = await sb.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Fetch google_accounts record
  const { data: account, error: fetchError } = await sb
    .from('google_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (fetchError || !account) {
    return null;
  }

  const typedAccount = account as GoogleAccount;

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(typedAccount.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() > now.getTime() + bufferMs) {
    // Token is still valid
    return decrypt(typedAccount.access_token);
  }

  // Token expired, refresh it
  const refreshToken = await decrypt(typedAccount.refresh_token);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', errorText);
    return null;
  }

  const tokens = await tokenResponse.json();
  const { access_token, expires_in } = tokens;

  if (!access_token) {
    console.error('No access_token in refresh response');
    return null;
  }

  // Encrypt and update
  const encryptedAccessToken = await encrypt(access_token);
  const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  await sb
    .from('google_accounts')
    .update({
      access_token: encryptedAccessToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  return access_token;
}

/**
 * Wrapper for Google API requests with automatic token handling
 */
export async function googleFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('No valid Google access token available');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Checks if the current user has connected their Google Calendar
 */
export async function isGoogleConnected(): Promise<boolean> {
  const sb = await supabaseServer();
  const { data: { user }, error: authError } = await sb.auth.getUser();

  if (authError || !user) {
    return false;
  }

  const { data, error } = await sb
    .from('google_accounts')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  return !error && !!data;
}

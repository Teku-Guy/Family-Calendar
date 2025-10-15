'use client';

import { supabaseBrowser } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if already signed in
    const checkSession = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/calendar');
      } else {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Sign-in error:', error);

        // Check if this is a provider configuration error
        if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          setError(
            'Google sign-in provider is not enabled. Please enable it in Supabase Dashboard → Authentication → Providers → Google.'
          );
        } else if (error.message?.includes('redirect')) {
          setError(
            'OAuth redirect URI mismatch. Please add this URL to your Google Cloud Console authorized redirect URIs: ' +
            `${window.location.origin}/auth/callback`
          );
        } else {
          setError(`Sign-in failed: ${error.message}`);
        }

        setLoading(false);
      }
      // If no error, OAuth redirect will happen automatically
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Family Calendar</h1>
          <p className="mt-2 text-white/70">Sign in to access your family&apos;s calendar</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-medium mb-1">Error</p>
            <p>{error}</p>
            <a
              href="/api/diagnostics/auth"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-red-300 underline hover:text-red-100"
            >
              View diagnostics →
            </a>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-4 py-3 text-base font-medium text-black hover:bg-white/90 active:bg-white/80 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p className="mt-6 text-center text-sm text-white/50">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  );
}

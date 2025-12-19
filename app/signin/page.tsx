'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from 'react-google-recaptcha-v3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function SignInPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { toast } = useToast();

  // Check which OAuth providers are configured
  const hasGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_ENABLED;
  const hasApple = !!process.env.NEXT_PUBLIC_APPLE_ENABLED;
  const hasWikimedia = !!process.env.NEXT_PUBLIC_WIKIMEDIA_ENABLED;
  const hasMastodon = !!process.env.NEXT_PUBLIC_MASTODON_ENABLED;

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Require reCAPTCHA for magic link
      if (!executeRecaptcha) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'reCAPTCHA not loaded. Please refresh and try again.',
        });
        setIsSubmitting(false);
        return;
      }

      const recaptchaToken = await executeRecaptcha('email_signin');

      // Verify reCAPTCHA on server before sending magic link
      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken }),
      });

      if (!verifyResponse.ok) {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Please try again or contact support.',
        });
        setIsSubmitting(false);
        return;
      }

      await signIn('email', { email, callbackUrl });
      toast({
        title: 'Check Your Email',
        description: 'We sent you a sign-in link.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send sign-in link. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/logos/pana_logo_long_blue.png"
            alt="Pana MIA"
            width={300}
            height={75}
            className="h-auto max-w-full"
            priority
          />
          <p className="max-w-md text-center text-gray-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardContent className="space-y-6 p-8">
            {/* Welcome Message / Ad Copy Space */}
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome to Pana MIA
              </h1>
              <p className="text-gray-600">
                Join South Florida's creative community directory. Connect with
                local artists, creators, and cultural leaders.
              </p>

              {/* Optional: Uncomment to add welcome video */}
              {/*
              <div className="aspect-video w-full bg-gray-100 rounded-lg overflow-hidden">
                <iframe
                  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              */}
            </div>

            {/* OAuth Sign-In Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => handleOAuthSignIn('google')}
                className="w-full border border-gray-300 bg-white text-gray-900 shadow-sm hover:bg-gray-50"
                size="lg"
                disabled={!hasGoogle}
                title={!hasGoogle ? 'Google sign-in not configured' : ''}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
                Continue with Google
              </Button>

              <Button
                onClick={() => handleOAuthSignIn('apple')}
                className="w-full bg-black text-white hover:bg-gray-900"
                size="lg"
                disabled={!hasApple}
                title={!hasApple ? 'Apple sign-in not configured' : ''}
              >
                <svg
                  className="mr-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </Button>

              <Button
                onClick={() => handleOAuthSignIn('wikimedia')}
                className="w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                size="lg"
                disabled={!hasWikimedia}
                title={!hasWikimedia ? 'Wikimedia sign-in not configured' : ''}
              >
                <Image
                  src="https://authjs.dev/img/providers/wikimedia.svg"
                  alt="Wikimedia"
                  width={20}
                  height={20}
                  className="mr-2"
                />
                Continue with Wikimedia
              </Button>

              <Button
                onClick={() => handleOAuthSignIn('mastodon')}
                className="w-full bg-[#6364FF] text-white hover:bg-[#563ACC]"
                size="lg"
                disabled={!hasMastodon}
                title={!hasMastodon ? 'Mastodon sign-in not configured' : ''}
              >
                <svg
                  className="mr-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.193 7.879c0-5.206-3.411-6.732-3.411-6.732C18.062.357 15.108.025 12.041 0h-.076c-3.068.025-6.02.357-7.74 1.147 0 0-3.411 1.526-3.411 6.732 0 1.192-.023 2.618.015 4.129.124 5.092.934 10.109 5.641 11.355 2.17.574 4.034.695 5.535.612 2.722-.15 4.25-.972 4.25-.972l-.09-1.975s-1.945.613-4.129.539c-2.165-.074-4.449-.233-4.799-2.891a5.499 5.499 0 0 1-.048-.745s2.125.52 4.817.643c1.646.075 3.19-.097 4.758-.283 3.007-.359 5.625-2.212 5.954-3.905.517-2.665.475-6.507.475-6.507zm-4.024 6.709h-2.497V8.469c0-1.29-.543-1.944-1.628-1.944-1.2 0-1.802.776-1.802 2.312v3.349h-2.483v-3.349c0-1.536-.602-2.312-1.802-2.312-1.085 0-1.628.655-1.628 1.944v6.119H4.832V8.284c0-1.289.328-2.313.987-3.07.68-.758 1.569-1.146 2.674-1.146 1.278 0 2.246.491 2.886 1.474L12 6.585l.622-1.043c.64-.983 1.608-1.474 2.886-1.474 1.104 0 1.994.388 2.674 1.146.658.757.986 1.781.986 3.07v6.304z" />
                </svg>
                Continue with Mastodon
              </Button>
            </div>

            {/* Email Sign-In Toggle */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">or</span>
              </div>
            </div>

            {!showEmailForm ? (
              <button
                onClick={() => setShowEmailForm(true)}
                className="text-pana-blue w-full text-center text-sm hover:underline"
              >
                Sign in with email
              </button>
            ) : (
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-center text-xs text-gray-500">
                  Protected by reCAPTCHA
                </p>
                <Button
                  type="submit"
                  className="bg-pana-pink hover:bg-pana-pink/90 w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Sending sign-in link...'
                    : 'Send sign-in link'}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                >
                  Back to other options
                </button>
              </form>
            )}

            {/* Footer */}
            <p className="pt-4 text-center text-xs text-gray-500">
              By continuing, you agree to our{' '}
              <Link
                href="/doc/terms-and-conditions"
                className="text-pana-blue hover:underline"
              >
                Terms & Conditions
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <p className="text-center text-sm text-gray-600">
          Need help?{' '}
          <Link
            href="/form/contact-us"
            className="text-pana-blue hover:underline"
          >
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!recaptchaSiteKey) {
    console.error('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">
          reCAPTCHA is not configured. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
      <SignInPageContent />
    </GoogleReCaptchaProvider>
  );
}

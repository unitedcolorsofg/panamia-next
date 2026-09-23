'use client';

import { signIn } from '@/lib/auth-client';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState, Suspense, type ReactNode } from 'react';
import type { SurfaceId } from '@/lib/panaverse/surfaces';
import type { SurfaceMark } from '@/lib/panaverse/branding';
import { useTurnstile } from '@/components/Turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation, Trans } from 'react-i18next';

function GoogleIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

function AppleIcon() {
  return (
    <svg
      className="mr-2 h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function MastodonIcon() {
  return (
    <svg
      className="mr-2 h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M23.193 7.879c0-5.206-3.411-6.732-3.411-6.732C18.062.357 15.108.025 12.041 0h-.076c-3.068.025-6.02.357-7.74 1.147 0 0-3.411 1.526-3.411 6.732 0 1.192-.023 2.618.015 4.129.124 5.092.934 10.109 5.641 11.355 2.17.574 4.034.695 5.535.612 2.722-.15 4.25-.972 4.25-.972l-.09-1.975s-1.945.613-4.129.539c-2.165-.074-4.449-.233-4.799-2.891a5.499 5.499 0 0 1-.048-.745s2.125.52 4.817.643c1.646.075 3.19-.097 4.758-.283 3.007-.359 5.625-2.212 5.954-3.905.517-2.665.475-6.507.475-6.507zm-4.024 6.709h-2.497V8.469c0-1.29-.543-1.944-1.628-1.944-1.2 0-1.802.776-1.802 2.312v3.349h-2.483v-3.349c0-1.536-.602-2.312-1.802-2.312-1.085 0-1.628.655-1.628 1.944v6.119H4.832V8.284c0-1.289.328-2.313.987-3.07.68-.758 1.569-1.146 2.674-1.146 1.278 0 2.246.491 2.886 1.474L12 6.585l.622-1.043c.64-.983 1.608-1.474 2.886-1.474 1.104 0 1.994.388 2.674 1.146.658.757.986 1.781.986 3.07v6.304z" />
    </svg>
  );
}

function WikimediaIcon() {
  return (
    <Image
      src="https://authjs.dev/img/providers/wikimedia.svg"
      alt=""
      width={20}
      height={20}
      className="mr-2"
      aria-hidden="true"
    />
  );
}

export interface SignInViewProps {
  /** The surface serving this sign-in. */
  surfaceId: SurfaceId;
  surfaceName: string;
  /** This surface's front door — where a member lands once signed in. */
  rootPath: string;
  /** The wordmark this surface flies. */
  mark: SurfaceMark;
  /**
   * Absolute origin of the main site as reached from this host, or null when
   * this already is the main site. Resolved on the server so local dev links
   * across the hall rather than out to production.
   */
  mainSiteUrl: string | null;
  mainSiteName: string;
}

/**
 * Crosses to the main site's own origin when rendered on a surface hostname.
 *
 * Reserved for the main site's front door. Borrowed pages — legal, forms —
 * used to arrive bare on a surface, which is why everything pointing at the
 * main site once crossed; guest chrome frames them now, so they link
 * relatively and keep the member on the hostname they chose. Sending someone
 * to another origin to read the terms is the dead end this page's own footer
 * exists to avoid.
 *
 * The homepage is the exception: going there is a deliberate departure, the
 * same intent as the footer's link home, so it still crosses.
 *
 * On the main site itself `base` is null and this stays a client-side
 * navigation.
 */
function MainSiteLink({
  href,
  base,
  className,
  children,
}: {
  href: string;
  base: string | null;
  className?: string;
  children: ReactNode;
}) {
  if (!base) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={`${base}${href}`} className={className}>
      {children}
    </a>
  );
}

function SignInPageContent({
  surfaceId,
  surfaceName,
  rootPath,
  mark,
  mainSiteUrl,
  mainSiteName,
}: SignInViewProps) {
  const searchParams = useSearchParams();
  /* Default to this surface's front door, not the main site's. Signing in on
     Pana Social used to drop the member on the directory, which reads as the
     sign-in having failed and sent them somewhere else. */
  const callbackUrl = searchParams?.get('callbackUrl') || rootPath;
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const {
    token: turnstileToken,
    error: turnstileError,
    reset: resetTurnstile,
    Widget: TurnstileWidget,
  } = useTurnstile(turnstileSiteKey, 'email_signin');
  const { toast } = useToast();
  const { t: tToast } = useTranslation('toast');
  const { t } = useTranslation('signin');

  /* Copy that names the room the member is entering. `welcomeTitle_social`
     wins over `welcomeTitle` when it exists, so giving a surface its own voice
     means adding keys rather than branching here. */
  const ts = (key: string) =>
    t(`${key}_${surfaceId}`, { defaultValue: t(key) });

  // Show different ad copy based on callback URL
  const isBecomeAPana = callbackUrl.includes('form/become-a-pana');

  // Only providers with credentials configured are offered. All four flags
  // default to 'false' (lib/env.config.ts), so rendering the unconfigured ones
  // as disabled buttons meant a default deployment showed four dead controls
  // with the magic link — the one path that always works — buried beneath them.
  const oauthProviders: {
    id: string;
    enabled: boolean;
    label: string;
    icon: ReactNode;
    className: string;
  }[] = [
    {
      id: 'google',
      enabled: process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true',
      label: t('continueGoogle'),
      icon: <GoogleIcon />,
      className:
        'w-full border border-pana-ink/15 bg-white text-gray-900 shadow-sm hover:bg-gray-50',
    },
    {
      id: 'apple',
      enabled: process.env.NEXT_PUBLIC_APPLE_ENABLED === 'true',
      label: t('continueApple'),
      icon: <AppleIcon />,
      className: 'w-full bg-black text-white hover:bg-gray-900',
    },
    {
      id: 'wikimedia',
      enabled: process.env.NEXT_PUBLIC_WIKIMEDIA_ENABLED === 'true',
      label: t('continueWikimedia'),
      icon: <WikimediaIcon />,
      className:
        'w-full border border-pana-ink/15 bg-white text-gray-900 hover:bg-gray-50',
    },
    {
      id: 'mastodon',
      enabled: process.env.NEXT_PUBLIC_MASTODON_ENABLED === 'true',
      label: t('continueMastodon'),
      icon: <MastodonIcon />,
      className: 'w-full bg-[#6364FF] text-white hover:bg-[#563ACC]',
    },
  ].filter((provider) => provider.enabled);

  const hasOAuth = oauthProviders.length > 0;
  // With no OAuth to choose between, the toggle is a pointless extra click.
  const emailFormOpen = showEmailForm || !hasOAuth;

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!turnstileToken) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: tToast('turnstileNotReady'),
        });
        setIsSubmitting(false);
        return;
      }

      const verifyResponse = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      });

      if (!verifyResponse.ok) {
        toast({
          variant: 'destructive',
          title: tToast('verificationFailed'),
          description: tToast('verificationFailedDesc'),
        });
        resetTurnstile();
        setIsSubmitting(false);
        return;
      }

      resetTurnstile();
      await signIn('email', { email, callbackUrl });
      toast({
        title: tToast('checkEmail'),
        description: tToast('checkEmailDesc'),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: tToast('error'),
        description: tToast('signInFailed'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-surface flex flex-col items-center px-4 py-12 sm:py-16"
      data-standalone="true"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* The surface's own mark. This is the page's only chrome: there is no
            masthead above it, so the wordmark is what tells a member which
            door they are standing at. */}
          <div className="flex flex-col items-center space-y-4">
            <Image
              src={mark.src}
              alt={mark.alt}
              width={mark.width}
              height={mark.height}
              className="h-auto w-64 max-w-full"
              priority
            />
            {/* Copy depends on how the visitor got here: someone mid-way through
              "Become a Pana" needs to know what they're signing up for, while
              everyone else is most likely returning. */}
            <p className="text-pana-ink/75 dark:text-muted-foreground max-w-md text-center text-sm leading-relaxed">
              {isBecomeAPana ? (
                <>
                  {t('adCopyBecomeAPana')}{' '}
                  <MainSiteLink
                    href="/#faq-what-is-a-pana"
                    base={mainSiteUrl}
                    className="text-pana-indigo dark:text-pana-flame font-semibold underline"
                  >
                    <Trans
                      i18nKey="adCopyBecomeAPanaLink"
                      t={t}
                      components={{ em: <em /> }}
                    />
                  </MainSiteLink>
                </>
              ) : (
                ts('adCopyDefault')
              )}
            </p>
          </div>

          {/* The dark theme sets --card and --background to the same value, so a
            dark border would leave the card with no visible edge. */}
          <Card className="border-pana-ink/10 rounded-2xl shadow-xl dark:border-white/10">
            <CardContent className="space-y-6 p-8">
              {/* Welcome Message / Ad Copy Space */}
              <div className="flex flex-col items-center space-y-3 text-center">
                <span className="section-eyebrow">{t('eyebrow')}</span>
                <h1 className="text-foreground text-2xl font-black tracking-tight">
                  {ts('welcomeTitle')}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {ts('welcomeDesc')}
                </p>
              </div>

              {/* OAuth sign-in — configured providers only */}
              {hasOAuth && (
                <div className="space-y-3">
                  {oauthProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      onClick={() => handleOAuthSignIn(provider.id)}
                      className={provider.className}
                      size="lg"
                    >
                      {provider.icon}
                      {provider.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Divider only separates two things that are both on screen. */}
              {hasOAuth && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="border-pana-ink/15 w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-card text-muted-foreground px-2">
                      {t('or')}
                    </span>
                  </div>
                </div>
              )}

              {!emailFormOpen ? (
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="text-pana-indigo dark:text-pana-flame w-full text-center text-sm font-semibold hover:underline"
                >
                  {t('signInWithEmail')}
                </button>
              ) : (
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <Input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  {TurnstileWidget}
                  {turnstileError && (
                    <p className="text-destructive text-center text-sm">
                      {t('turnstileBlocked')}
                    </p>
                  )}
                  {/* Flame carries ink, never cream — see the contrast rule in
                    globals.css. */}
                  <Button
                    type="submit"
                    className="bg-pana-flame text-pana-ink hover:bg-pana-burnt w-full font-extrabold"
                    disabled={
                      isSubmitting || (!!turnstileSiteKey && !turnstileToken)
                    }
                  >
                    {isSubmitting ? t('sendingLink') : t('sendLink')}
                  </Button>
                  {hasOAuth && (
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="text-muted-foreground hover:text-foreground w-full text-center text-sm"
                    >
                      {t('backToOptions')}
                    </button>
                  )}
                </form>
              )}

              {/* Footer */}
              <p className="text-muted-foreground pt-2 text-center text-xs">
                {t('termsAgreement')}{' '}
                <Link
                  href="/legal/terms"
                  className="text-pana-indigo dark:text-pana-flame font-semibold hover:underline"
                >
                  {t('termsLink')}
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <p className="text-pana-ink/70 dark:text-muted-foreground text-center text-sm">
            {t('needHelp')}{' '}
            <Link
              href="/form/contact-us"
              className="text-pana-indigo dark:text-pana-flame font-semibold hover:underline"
            >
              {t('contactUs')}
            </Link>
          </p>
        </div>
      </div>

      {/* Standing in for the site footer this page no longer has. It carries
          only what a signed-out visitor needs: the legal links, and — from a
          surface — the way back to the main site, with the reassurance that
          nobody is being asked for a second account. */}
      <footer className="mt-12 flex w-full max-w-md flex-col items-center gap-3 text-center">
        {mainSiteUrl && (
          <p className="text-pana-ink/70 dark:text-muted-foreground text-xs">
            {t('partOfPanaverse', {
              surface: surfaceName,
              main: mainSiteName,
            })}
          </p>
        )}
        <nav
          aria-label={t('footerNavLabel')}
          className="text-pana-ink/70 dark:text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs"
        >
          {mainSiteUrl && (
            <a href={mainSiteUrl} className="font-semibold hover:underline">
              {t('goToMain', { main: mainSiteName })}
            </a>
          )}
          <Link href="/legal/terms" className="hover:underline">
            {t('termsLink')}
          </Link>
          <Link href="/legal/privacy" className="hover:underline">
            {t('privacyLink')}
          </Link>
        </nav>
      </footer>
    </div>
  );
}

export function SignInView(props: SignInViewProps) {
  return (
    <Suspense
      fallback={
        <div
          className="auth-surface flex items-center justify-center"
          data-standalone="true"
        >
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      }
    >
      <SignInPageContent {...props} />
    </Suspense>
  );
}

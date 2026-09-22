import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import '../styles/flower-power.css';
import { Providers } from './providers';
import { ThemeProvider } from '@/components/theme-provider';
import { FlowerPowerProvider } from '@/components/flower-power/FlowerPowerProvider';
import MainHeader from '@/components/MainHeader';
import MainFooter from '@/components/MainFooter';
import ScreennameGate from '@/components/ScreennameGate';
import { resolveSurface } from '@/lib/panaverse/surfaces';
import { PATHNAME_HEADER, wearsOwnChrome } from '@/lib/panaverse/chrome';

export const metadata: Metadata = {
  title: 'Pana Mia',
  description: 'Community platform for Pana Mia',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const isProductionSite = host.includes('panamia.club');

  /* Which panaverse surface is serving this request.
   *
   * The Worker already routes hostnames — social.panamia.club sends `/` to the
   * social front door — but the layout did not know surfaces existed, so every
   * host got the Pana Mia Club masthead and footer. That is the single reason
   * Pana Social still read as a section of the main site rather than a place of
   * its own: a member crossed an origin and landed under the same header.
   *
   * Surfaces other than the main site bring their own chrome, so the shared
   * layout stays out of their way. It still provides everything that is
   * genuinely global — fonts, theme, providers, the screenname gate — because
   * those are properties of the account, not of the room it is being used in.
   *
   * Exercise this locally at social.localhost:3002; `resolveSurface` maps
   * *.localhost the same way it maps *.panamia.club. */
  const surface = resolveSurface(host);

  /* A few routes are doorways rather than rooms and frame themselves on every
   * surface — see lib/panaverse/chrome.ts. Sign-in is the one that exists
   * today: it used to render the Pana Mia wordmark in the masthead and then
   * again above the card, and on a surface hostname it rendered with nothing
   * at all. The path comes from the Worker because the runtime hands the
   * server renderer a Host header but no pathname. */
  const standalone = wearsOwnChrome(requestHeaders.get(PATHNAME_HEADER));
  const wearsMainChrome = surface.id === 'www' && !standalone;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400..900&family=Montserrat:wght@400;500;600;700&family=Rubik:wght@400;500&display=swap"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Pana MIA Articles"
          href="/feed.xml"
        />
        <link
          rel="alternate"
          type="application/feed+json"
          title="Pana MIA Articles (JSON)"
          href="/feed.json"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <FlowerPowerProvider>
            <Providers>
              {wearsMainChrome && (
                <MainHeader isProductionSite={isProductionSite} />
              )}
              <div id="layout-main">{children}</div>
              {wearsMainChrome && <MainFooter />}
              <ScreennameGate />
            </Providers>
          </FlowerPowerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

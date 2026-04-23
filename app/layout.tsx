import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import '../styles/flower-power.css';
import { Providers } from './providers';
import { ThemeProvider } from '@/components/theme-provider';
import { FlowerPowerProvider } from '@/components/flower-power/FlowerPowerProvider';
import MainHeader from '@/components/MainHeader';
import MainFooter from '@/components/MainFooter';

export const metadata: Metadata = {
  title: 'Pana Mia',
  description: 'Community platform for Pana Mia',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get('host') ?? '';
  const isProductionSite = host.includes('pana.social');
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
          defaultTheme="flower-power"
          enableSystem
          disableTransitionOnChange
        >
          <FlowerPowerProvider>
            <Providers>
              <MainHeader isProductionSite={isProductionSite} />
              <div id="layout-main">{children}</div>
              <MainFooter />
            </Providers>
          </FlowerPowerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

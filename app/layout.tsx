import type { Metadata } from 'next';
import { Nunito, Rubik } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeProvider } from '@/components/theme-provider';
import MainHeader from '@/components/MainHeader';
import MainFooter from '@/components/MainFooter';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
});

const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rubik',
});

export const metadata: Metadata = {
  title: 'Pana Mia',
  description: 'Community platform for Pana Mia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} ${rubik.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <MainHeader />
            <div id="layout-main">{children}</div>
            <MainFooter />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

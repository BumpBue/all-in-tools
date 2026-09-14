import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from 'next/font/google';

import '@/app/globals.css';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { getMessages } from '@/config/i18n';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '@/config/site';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { readPreferences } from '@/lib/cookies.server';
import { DARK_CLASS, THEME_ATTRIBUTE, THEME_INIT_SCRIPT } from '@/lib/theme';
import { cn } from '@/lib/utils';

const MAIN_ID = 'main-content';

const sans = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-app-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-app-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE.th,
  description: SITE_DESCRIPTION.th,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const preferences = await readPreferences();
  const t = getMessages(preferences.locale);

  return (
    <html
      lang={preferences.locale}
      className={cn(
        sans.variable,
        mono.variable,
        preferences.theme === 'dark' && DARK_CLASS,
      )}
      // The init script resolves "system" before paint, so the class it sets
      // will not match what the server rendered.
      suppressHydrationWarning
      {...{ [THEME_ATTRIBUTE]: preferences.theme }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <PreferencesProvider initial={preferences}>
          <a
            href={`#${MAIN_ID}`}
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
          >
            {t.skipToContent}
          </a>

          <Header />

          <main id={MAIN_ID} className="mx-auto w-full max-w-content flex-1 px-4 py-8">
            {children}
          </main>

          <Footer />
        </PreferencesProvider>
      </body>
    </html>
  );
}

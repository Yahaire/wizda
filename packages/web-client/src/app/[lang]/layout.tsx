import type {
  Metadata,
  Viewport,
} from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '../globals.css';

import { Cinzel, Inter, Patrick_Hand } from 'next/font/google';
import { notFound } from 'next/navigation';

import { DetailProvider } from '@/components/detail/DetailProvider';
import { JapanesePreviewNotice } from '@/components/JapanesePreviewNotice';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { Shell } from '@/components/Shell';
import { VersionLog } from '@/components/VersionLog';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { isSupportedLanguage, OFFERED_LANGUAGES } from '@/i18n/locale';
import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { APP_NAME } from '../app.constants';
import { buildPageMetadata } from '../pageMetadata';
import { wizdaTheme } from '../theme';

const display = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Wizda's speaking voice — Patrick Hand, a friendly print-hand. See
// `.wizda-speech` in globals.css.
const speech = Patrick_Hand({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-speech',
  display: 'swap',
});

/**
 * The language is a route segment, so both locales are prerendered at build
 * time and every response — including the very first paint — is already in the
 * right language. That is what removes the English flash a client-side switch
 * could never avoid; see `docs/i18n.md`.
 */
export function generateStaticParams(): Array<{ lang: string }> {
  return OFFERED_LANGUAGES.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: '#0a0908',
};

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  // `notFound()` in the layout below handles the bad-prefix case; bail quietly
  // here rather than resolving a catalog that doesn't exist.
  if (!isSupportedLanguage(lang)) {
    return {};
  }

  return {
    // The home route's copy is the sitewide default; each page overrides it.
    ...buildPageMetadata(lang, 'home'),
    applicationName: APP_NAME,
    icons: { icon: '/icon.svg' },
    appleWebApp: {
      capable: true,
      title: APP_NAME,
      statusBarStyle: 'black-translucent',
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode,
  params: Promise<{ lang: string }>,
}>) {
  const { lang } = await params;
  // An unknown prefix (`/fr/junks`) is a 404, not a silent fall back to English —
  // otherwise every bogus prefix would serve a duplicate of the English site.
  if (!isSupportedLanguage(lang)) {
    notFound();
  }

  // Env-gated: no script rendered until an Umami site id is provisioned.
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html
      lang={lang}
      {...mantineHtmlProps}
      className={`${display.variable} ${body.variable} ${speech.variable}`}
    >
      <head>
        <ColorSchemeScript forceColorScheme="dark" />
        {umamiWebsiteId && (
          <script
            defer
            src="/umami/script.js"
            data-website-id={umamiWebsiteId}
            data-host-url="/umami"
          />
        )}
      </head>
      <body>
        <MantineProvider theme={wizdaTheme} forceColorScheme="dark">
          <LanguageProvider lang={lang}>
            <Notifications
              position="bottom-center"
              limit={3}
              autoClose={5000}
            />
            <MaintenanceGate />
            {/* TEMPORARY — see `JapanesePreviewNotice`; delete both when the
                Japanese copy has been edited. Gated here rather than inside the
                component so the prerendered English pages never carry it. */}
            {lang === 'ja' && <JapanesePreviewNotice />}
            <Shell>
              <DetailProvider>{children}</DetailProvider>
            </Shell>
            <VersionLog />
          </LanguageProvider>
        </MantineProvider>
      </body>
    </html>
  );
}

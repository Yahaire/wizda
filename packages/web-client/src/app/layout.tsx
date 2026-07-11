import type {
  Metadata,
  Viewport,
} from 'next';
import {
  Cinzel,
  Inter,
  Patrick_Hand,
} from 'next/font/google';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { MaintenanceGate } from '@/components/MaintenanceGate';
import { Shell } from '@/components/Shell';
import { VersionLog } from '@/components/VersionLog';

import {
  APP_DESCRIPTION,
  APP_NAME,
} from './app.constants';
import { wizdaTheme } from './theme';

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

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: { icon: '/icon.svg' },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode,
}>) {
  // Env-gated: no script rendered until an Umami site id is provisioned.
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html
      lang="en"
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
          <Notifications
            position="bottom-center"
            limit={3}
            autoClose={5000}
          />
          <MaintenanceGate />
          <Shell>{children}</Shell>
          <VersionLog />
        </MantineProvider>
      </body>
    </html>
  );
}

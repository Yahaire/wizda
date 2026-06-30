import type { Metadata } from "next";
import './globals.css';

import { APP_NAME } from './app.constants';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Work out how much junk to farm to guarantee the item you want in Wizardry Variants Daphne.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

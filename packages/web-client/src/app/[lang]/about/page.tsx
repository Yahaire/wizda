import { buildPageMetadata } from '@/app/pageMetadata';
import { AboutContent } from '@/components/AboutContent';
import { isSupportedLanguage } from '@/i18n/locale';

import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  return isSupportedLanguage(lang) ? buildPageMetadata(lang, 'about') : {};
}

export default function AboutPage() {
  return <AboutContent />;
}

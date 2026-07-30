import { buildPageMetadata } from '@/app/pageMetadata';
import { JunkListView } from '@/components/lists/JunkListView';
import { isSupportedLanguage } from '@/i18n/locale';

import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  return isSupportedLanguage(lang) ? buildPageMetadata(lang, 'junks') : {};
}

export default function JunksPage() {
  return <JunkListView />;
}

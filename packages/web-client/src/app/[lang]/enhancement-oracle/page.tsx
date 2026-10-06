import { buildPageMetadata } from '@/app/pageMetadata';
import { EnhancementOraclePage } from '@/components/enhancement/EnhancementOraclePage';
import { isSupportedLanguage } from '@/i18n/locale';

import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  return isSupportedLanguage(lang) ? buildPageMetadata(lang, 'enhancement') : {};
}

export default function EnhancementOracleRoutePage() {
  return <EnhancementOraclePage />;
}

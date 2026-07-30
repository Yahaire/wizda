import { buildPageMetadata } from '@/app/pageMetadata';
import { EquipmentListView } from '@/components/lists/EquipmentListView';
import { isSupportedLanguage } from '@/i18n/locale';

import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  return isSupportedLanguage(lang) ? buildPageMetadata(lang, 'equipment') : {};
}

export default function EquipmentPage() {
  return <EquipmentListView />;
}

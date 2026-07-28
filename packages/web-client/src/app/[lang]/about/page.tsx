import type { Metadata } from 'next';

import { AboutContent } from '@/components/AboutContent';
import {
  APP_NAME,
  PAGE_TITLE_SUFFIX,
} from '@/app/app.constants';

export const metadata: Metadata = {
  title: `About${PAGE_TITLE_SUFFIX}`,
  description: `What ${APP_NAME} is, how the junk-guarantee math works, and our data & privacy approach.`,
};

export default function AboutPage() {
  return <AboutContent />;
}

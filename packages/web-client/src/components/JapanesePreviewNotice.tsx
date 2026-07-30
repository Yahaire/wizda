'use client';

import { useEffect, useState } from 'react';

import { ISSUES_URL } from '@/app/app.constants';
import { WizdaGlyph, WizdaMark } from '@/mascot/wizda';
import {
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core';

/**
 * TEMPORARY (added 2026-07-30) — a one-per-session heads-up that the Japanese
 * copy is still machine-translated in places. To retire it, delete this file
 * and its single `lang === 'ja'` mount in `app/[lang]/layout.tsx`.
 *
 * The copy lives here rather than in `src/i18n/strings.ts` on purpose: it is
 * Japanese-only and short-lived, so it should disappear with the component
 * instead of leaving a hole in both catalogs. Only ever mounted on `/ja/…`.
 */

const DISMISSED_KEY = 'wizda.jaPreviewNoticeDismissed';

export function JapanesePreviewNotice() {
  const [opened, setOpened] = useState(false);

  // Post-mount so the prerendered HTML is identical for every visitor and the
  // modal can read sessionStorage — once per browser session, not once ever,
  // since the notice matters more than the interruption costs while it stands.
  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) {
      return;
    }
    setOpened(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setOpened(false);
  };

  return (
    <Modal
      opened={opened}
      onClose={dismiss}
      title="日本語版はプレビュー版です"
      size="md"
      centered
    >
      <Stack gap="md">
        <Text className="wizda-speech">
          <WizdaMark glyph={WizdaGlyph.info} />
          日本語の表記には、まだ機械翻訳のままのところが残っているの。順番に直しているところだから、少し変な言い回しがあっても許してね。数字と計算はどの言語でも同じだから、そこは安心して。
        </Text>
        <Text size="xs" c="dimmed">
          気になる表記を見つけたら
          <Anchor href={ISSUES_URL} target="_blank" rel="noopener noreferrer" size="xs">
            こちら
          </Anchor>
          から教えてくれると助かるわ。
        </Text>
        <Group justify="flex-end">
          <Button color="crimson" onClick={dismiss}>
            わかった
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

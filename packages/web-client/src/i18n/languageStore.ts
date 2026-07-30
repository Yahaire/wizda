import { wizdaLinesEn } from '@/mascot/voice.en';
import { wizdaLinesJa } from '@/mascot/voice.ja';
import { LanguageCode } from '@shared/domain/language';

import { uiStringsEn } from './strings.en';
import { uiStringsJa } from './strings.ja';

import type { SupportedLanguage } from './locale';
import type { WizdaLines } from '@/mascot/voice';
import type { UiStrings } from './strings';

/**
 * The per-language catalogs, plus the module-level mirror of the active
 * language. Which language is *active* is decided by the URL and resolved in
 * `locale.ts` / `middleware.ts` — this module only maps a language to its text.
 */

const STRINGS_REGISTRY: Record<SupportedLanguage, UiStrings> = {
  en: uiStringsEn,
  ja: uiStringsJa,
};

const WIZDA_REGISTRY: Record<SupportedLanguage, WizdaLines> = {
  en: wizdaLinesEn,
  ja: wizdaLinesJa,
};

/** The UI-chrome catalog for a given language — the pure resolver behind `useStrings`. */
export function stringsFor(lang: SupportedLanguage): UiStrings {
  return STRINGS_REGISTRY[lang];
}

/** Wizda's catalog for a given language — the pure resolver behind `useWizda`. */
export function wizdaFor(lang: SupportedLanguage): WizdaLines {
  return WIZDA_REGISTRY[lang];
}

// Module-level mirror of the active language, kept in sync by LanguageProvider
// (the single writer). Non-React modules that can't call a hook — the API
// client, the Oracle's plain-TS filter/facet logic — read the current choice
// through the getters below instead of having it threaded through every call
// signature.
//
// Since the language now comes from the route, LanguageProvider sets this
// during its *first* render, so these getters are already correct before any
// descendant effect fires. That's what keeps `api.ts` from firing a cold-load
// request under the wrong language.
let activeLang: SupportedLanguage = LanguageCode.EN;

/** Called by LanguageProvider whenever the active route's language changes. */
export function setActiveLang(lang: SupportedLanguage): void {
  activeLang = lang;
}

export function getLang(): SupportedLanguage {
  return activeLang;
}

export function getStrings(): UiStrings {
  return STRINGS_REGISTRY[activeLang];
}

export function getWizda(): WizdaLines {
  return WIZDA_REGISTRY[activeLang];
}

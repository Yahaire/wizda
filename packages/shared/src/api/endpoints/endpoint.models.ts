import { LanguageCode } from '../../domain/language';

export interface RequestErrorInfo {
  errorCode: string,
  message: string,
}

export interface MaintenanceResponse {
  maintenance: true,
  message: string,
}

/**
 * One language's sync state for the localized junk/equipment display names
 * (mirrors `LanguageStatus` in schema.prisma). Included for `en` too, always
 * `isInSync: true` — a deliberate, uniform duplicate of `dataUpdatedAt` above —
 * so a future language switcher can read every language's status the same way.
 */
export interface LanguageSyncStatus {
  lang: LanguageCode,
  /** Whether this language's names aligned with English on the last seed attempt. */
  isInSync: boolean,
  /** ISO-8601 timestamp of the last successful sync for this language, or null if never. */
  lastSyncedAt: string | null,
  /** ISO-8601 timestamp of the last sync *attempt* for this language, in sync or not. */
  lastCheckedAt: string,
}

/**
 * Data-freshness status: when the DB was last successfully (re)seeded from the
 * scraping sources. Surfaced to players as "data last updated". Served by
 * `GET /data-status` and echoed on the root `GET /`.
 */
export interface DataStatusResponse {
  /** ISO-8601 timestamp of the last successful seed, or null if never seeded. */
  dataUpdatedAt: string | null,
  /** Per-language sync state — see {@link LanguageSyncStatus}. */
  languages: LanguageSyncStatus[],
}

// Generic infra models live here. Domain response/request models live in
// sibling files, e.g. the guarantee endpoints in ./junkToGuarantee.models.ts.

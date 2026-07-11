export interface RequestErrorInfo {
  errorCode: string,
  message: string,
}

export interface MaintenanceResponse {
  maintenance: true,
  message: string,
}

/**
 * Data-freshness status: when the DB was last successfully (re)seeded from the
 * scraping sources. Surfaced to players as "data last updated". Served by
 * `GET /data-status` and echoed on the root `GET /`.
 */
export interface DataStatusResponse {
  /** ISO-8601 timestamp of the last successful seed, or null if never seeded. */
  dataUpdatedAt: string | null,
}

// Generic infra models live here. Domain response/request models live in
// sibling files, e.g. the guarantee endpoints in ./junkToGuarantee.models.ts.

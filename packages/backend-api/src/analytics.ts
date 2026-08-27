import express from 'express';

/**
 * Fire-and-forget a custom event to Umami so we can see how the tools are
 * actually used — including direct API consumers, since this runs server-side
 * (browser-side events would miss them and be blocked by ad-blockers).
 *
 * Dormant until `UMAMI_API_URL` + `UMAMI_API_WEBSITE_ID` are set, so it's a
 * no-op in dev / until analytics is provisioned. Cookieless; no IPs are stored
 * by us. Mirrors the conjapo pattern (`trackVerbLookup`).
 *
 * `data` carries **counts and settings only, never item identities** — which
 * axes were used and how broadly, not what was searched for. See
 * `docs/analytics.md` for what we deliberately don't collect; the
 * `PopularJunkOracleQuery` tables are where actual query shapes live.
 */
function sendEvent(
  req: express.Request,
  eventName: string,
  url: string,
  data: Record<string, unknown>,
): void {
  // Read env lazily so it resolves after dotenv.config() has run in index.ts.
  const umamiApiUrl = process.env.UMAMI_API_URL;
  const umamiApiWebsiteId = process.env.UMAMI_API_WEBSITE_ID;
  const collectEndpoint = process.env.UMAMI_COLLECT_ENDPOINT ?? '/api/send';
  if (!umamiApiUrl || !umamiApiWebsiteId) {
    return;
  }

  // Umami rejects `language` payloads longer than 35 chars — keep the top tag.
  const primaryLanguage = (req.headers['accept-language'] ?? '').split(',')[0]?.slice(0, 35) ?? '';

  fetch(`${umamiApiUrl}${collectEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': req.headers['user-agent'] ?? '',
      'X-Forwarded-For': req.ip ?? '',
    },
    body: JSON.stringify({
      type: 'event',
      payload: {
        website: umamiApiWebsiteId,
        hostname: req.hostname,
        language: primaryLanguage,
        url,
        referrer: req.headers.referer ?? '',
        name: eventName,
        data,
      },
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>');
        console.error(`[analytics] umami send non-ok: ${response.status} ${response.statusText} — ${body}`);
      }
    })
    .catch((error) => console.error('[analytics] umami send failed:', error));
}

/** How the Junk Oracle is being used — filter breadth and certainty, no item names. */
export function trackGuaranteeQuery(
  req: express.Request,
  summary: {
    equipmentCount: number,
    qualityCount: number,
    gradeCount: number,
    blessingCount: number,
    certainty: number,
    total: number,
  },
): void {
  sendEvent(req, 'guarantee_query', '/junk-to-guarantee', summary);
}

/**
 * How the Enhancement Oracle is being used — how much of a piece the player
 * described, how far they mean to take it, and whether we could answer. No
 * equipment or blessing names, matching {@link trackGuaranteeQuery}.
 */
export function trackEnhancementQuery(
  req: express.Request,
  summary: {
    slotCount: number,
    freeSlotCount: number,
    targetCount: number,
    enhancementLevel: number,
    targetEnhancementLevel: number,
    hasAlteredSlot: boolean,
    hasProbability: boolean,
  },
): void {
  sendEvent(req, 'enhancement_query', '/enhancement-odds', summary);
}

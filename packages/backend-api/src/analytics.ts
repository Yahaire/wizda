import express from 'express';

/**
 * Fire-and-forget a `guarantee_query` custom event to Umami so we can see how the
 * Junk Oracle is actually used — including direct API consumers, since this runs
 * server-side (browser-side events would miss them and be blocked by ad-blockers).
 *
 * Dormant until `UMAMI_API_URL` + `UMAMI_API_WEBSITE_ID` are set, so it's a no-op
 * in dev / until analytics is provisioned. Cookieless; no IPs are stored by us.
 * Mirrors the conjapo pattern (`trackVerbLookup`).
 */
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
        url: '/junk-to-guarantee',
        referrer: req.headers.referer ?? '',
        name: 'guarantee_query',
        data: summary,
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

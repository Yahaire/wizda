# Analytics

What Wizda tracks, why, and — for anyone wondering why there's no "Accept
cookies" banner — what we deliberately *don't* collect. For the probability
math see [`docs/calculation.md`](./calculation.md); for the data model see
[`docs/domain.md`](./domain.md).

## Why there's no cookie banner

A cookie-consent banner exists to get your permission before a site does
something to identify or follow you: dropping a cookie, tying your visits
together, building a profile. Wizda doesn't do any of that.

Everything below runs **without cookies**, without accounts, and without
storing your IP on our side. It never links one visit to the next, never
follows you across sites, and never builds a profile of you — it only keeps
**anonymous, aggregate counts**: how many people used a feature, which items
came up often. There's simply nothing here for a consent banner to gate, so we
don't put one in front of you. If that's ever untrue of something we add,
we'll add a banner and say so plainly — but nothing here today needs one.

## What we track, and why

### 1. Page views (web-client)

A single self-hosted [Umami](https://umami.is/) script tag, loaded in
[`layout.tsx`](../packages/web-client/src/app/layout.tsx). Umami is
cookieless by design — it counts visits and page paths without a persistent
visitor ID. It's **env-gated**: the script only renders once a website ID is
configured, so it's a no-op in local development.

### 2. `guarantee_query` event (backend-api)

Every Junk Oracle search server-side fires a `guarantee_query` event to the
same Umami instance — see
[`analytics.ts`](../packages/backend-api/src/analytics.ts). It's server-side
(not a browser event) specifically so it also captures direct API consumers
and isn't dropped by ad-blockers, and it's **env-gated** the same way as the
web-client script.

This event stores **counts only**: how many equipment/blessings/etc. a query
picked, the certainty asked for, and how many results came back. It answers
"how do people use the tool" (how broad are typical searches, what certainty
do people pick) — not *which* equipment or blessing was searched. No IPs are
persisted by us.

### 3. "Most searched" tracking (backend-api)

The Umami event above deliberately can't answer "what's the most popular
equipment/blessing?" — it never records identities, only counts, and reading
that back at runtime would mean querying a third-party dashboard's report API
on every page load. So the actual searched **filters** (equipment names,
blessing/category codes, ranks, quality/grade levels) are recorded in our own
Postgres tables, `PopularJunkOracleQuery` and `PopularJunkOracleQueryTerm` (see
`schema.prisma`), via `recordPopularQuery` in
[`popularQueries.ts`](../packages/backend-api/src/popularQueries.ts).

Concretely: identical searches collapse into one counted row rather than
logging every request forever, so what's stored is "this combination of
filters has been searched N times" — not a per-visit history, and nothing
that identifies who searched it. This powers `GET /popular`, which the app can
use to surface or preload popular searches. As of this writing nothing in the
UI consumes it yet — the endpoint is groundwork, landed ahead of the feature
that will read it.

## Summary

| | Stores | Identity | Cookies | Gated |
|---|---|---|---|---|
| Page views | visit/path counts | none | no | env var |
| `guarantee_query` | filter-count/certainty stats | none | no | env var |
| Most-searched | searched filter combos (aggregate) | none | no | always on (own DB) |

All three are **self-hosted or self-owned** — Umami runs on our own server
rather than a third-party analytics SaaS, and the popularity tables live in
our own database. Nothing here is sold or shared with anyone.

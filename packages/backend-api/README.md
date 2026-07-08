# wizda backend-api

Express API package for wizda. Part of the monorepo — see the root README for running (`npm run dev:api`) and full DB setup/seeding workflows.

## Key commands

Run these from the **monorepo root** (consistent with how the root `build` and `db:setup` scripts invoke Prisma). If you run from `packages/backend-api` directly and get a schema-not-found error, switch to the root.

```bash
# Regenerate the Prisma client after editing schema.prisma
npx prisma generate

# Create and apply a new migration after schema changes
npx prisma migrate dev --name <description>
```

For seeding, see root README → *Updating data*.

## API endpoints

The request/response contracts are the shared models — the source of truth — in
[`packages/shared/src/api/endpoints/`](../shared/src/api/endpoints/); the math
behind the guarantee numbers is in
[`docs/calculation.md`](../../docs/calculation.md). All bodies are JSON.

| Method & path | Purpose | Models |
|---------------|---------|--------|
| `POST /junk-to-guarantee` | Rank the junks that can yield the desired gear, fewest-needed first. Body: equipment/quality/grade/blessing filters + optional `certainty`, `limit`, `offset`. | `junkToGuarantee.models.ts` |
| `POST /junk-to-guarantee/curve` | For a **single** named junk + the same filters, how much is needed across several `certainties`. | `junkToGuarantee.models.ts` |
| `GET /junks` | All junks (`name`, `hasMultiplePools`, `maxDropQuality`, `maxDropGrade`) for the filter selects and junk list. | `lists.models.ts` |
| `GET /equipment` | All droppable equipment with the junks each drops from. | `lists.models.ts` |

Notes:
- Equipment and junks are addressed by **name**, blessings by **code** (e.g.
  `ATK_PER`) — the stable public keys. An unknown name/code is a `400`
  (`UNKNOWN_EQUIPMENT` / `UNKNOWN_BLESSING`); an unknown curve `junkName` is a
  `404` (`UNKNOWN_JUNK`). Filter axes are OR-sets; `blessings` is an AND-set.
- Blessing queries flag their response `estimated: true` — the blessing joint is
  a modelling estimate (see `docs/calculation.md`).
- `POST /junk-to-guarantee` requires **at least one** filter (equipment / quality
  / grade / blessing) — a query with none is a `400` (`NO_QUERY`). Results are
  **paged**: `limit` is defaulted and hard-capped (`DEFAULT_GUARANTEE_LIMIT` /
  `MAX_GUARANTEE_LIMIT`), and the response carries `total` + `hasMore` for
  "show more". This keeps the absurd tail (junks needing 100k+) off the wire.

## Analytics

`src/analytics.ts` fires a fire-and-forget `guarantee_query` custom event to
Umami server-side (so it captures direct API consumers and dodges ad-blockers).
It's **dormant** unless `UMAMI_API_URL` + `UMAMI_API_WEBSITE_ID` are set — see the
`UMAMI_*` vars in the root `.env.example`.

## Testing

The core "how much junk to guarantee item X?" calculation is pure, Prisma-free
math kept in `packages/shared`
([`dropRateMath.ts`](../shared/src/domain/dropRateMath.ts), documented in
[`docs/calculation.md`](../../docs/calculation.md)) so it can be unit-tested
without a DB. Its tests sit alongside it and run with
[vitest](https://vitest.dev/) from the **monorepo root**:

```bash
npm test            # run the whole suite once
npm run test:watch  # re-run on change
```

## Data source

This project seeds its data by scraping gacha-rate HTML pages, e.g.
<https://wizardry.info/daphne/gacha_rates/en/alternations.html>. There are **two
distinct source tables** — *Drop Rates by Junk* (item + quality + grade) and
*Drop Rates Related to Additional Blessings* (which blessing per slot). Their
structure, and the domain model they map to, is documented in
[`docs/domain.md`](../../docs/domain.md).

The scrapers live in `prisma/seed-from-html/`. Each loads its HTML (remote URL
or a local copy) via a shared `loadHtml()` helper and parses it with
[cheerio](https://cheerio.js.org/). Both seeds are implemented and run together
from `seedFromHtml.ts` (`npm run seed`): the "Drop Rates by Junk" seed
(`dropRatesByJunk.parser.ts` / `.seed.ts`), configured via
`JUNK_DROP_RATES_SOURCE_URL`, and the additional-blessings seed
(`equipmentBlessingDropRate.parser.ts` / `.seed.ts`), configured via
`EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL` — both in the root `.env`.

Both drop-rate tables are rebuilt from scratch on each scrape (truncate +
reinsert), so a weekly re-seed simply recompiles the latest rates.

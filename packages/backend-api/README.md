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

## Data source

This project seeds its data by scraping gacha-rate HTML pages, e.g.
<https://wizardry.info/daphne/gacha_rates/en/alternations.html>. There are **two
distinct source tables** — *Drop Rates by Junk* (item + quality + grade) and
*Drop Rates Related to Additional Blessings* (which blessing per slot). Their
structure, and the domain model they map to, is documented in
[`docs/domain.md`](../../docs/domain.md).

The scrapers live in `prisma/seed-from-html/`. Each loads its HTML (remote URL
or a local copy) via a shared `loadHtml()` helper and parses it with
[cheerio](https://cheerio.js.org/). The "Drop Rates by Junk" seed is
implemented (`dropRatesByJunk.parser.ts` / `.seed.ts`), configured via
`JUNK_DROP_RATES_SOURCE_URL` in the root `.env`; the blessings seed is not yet
implemented (`EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL` is reserved for it).

Both drop-rate tables are rebuilt from scratch on each scrape (truncate +
reinsert), so a weekly re-seed simply recompiles the latest rates.

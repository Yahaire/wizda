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
<https://wizardry.info/daphne/gacha_rates/en/alternations.html>.

The scraper skeleton lives in `prisma/seed-from-html/`. It loads the HTML
(remote URL or a local copy), parses it with [cheerio](https://cheerio.js.org/),
and is where the DB write will be wired up once the schema has models. The
source location is configured via `GACHA_RATES_SOURCE_URL` in the root `.env`.

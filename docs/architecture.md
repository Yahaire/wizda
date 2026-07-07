# Wizda architecture

How the code is layered and why. For the *game/data* model see
[`docs/domain.md`](./domain.md); for the *probability formula* see
[`docs/calculation.md`](./calculation.md). This doc is about **where work
happens** — which layer does what, and the principles behind that split.

## The three layers

```
packages/shared       Pure TypeScript. Domain reference data + pure logic.
                      No DB, no HTTP, no framework. Imported by both others.
        │
        ├── packages/backend-api    Express API + the scraper/seed. The only
        │                           layer that talks to PostgreSQL (Prisma).
        │
        └── packages/web-client     Next.js UI. Talks to the API over HTTP.
```

The dependency arrows only point **inward**: `backend-api` and `web-client`
depend on `shared`; `shared` depends on nobody. So anything in `shared` can be
used everywhere and tested in isolation.

## The core principle: the DB stores, the math module computes

The product's central feature — "how much junk to guarantee item X?" — is a
**read-then-compute** flow, not a database computation. Concretely, for the main
endpoint:

1. **DB read (all the DB does).** Fetch the `EquipmentDropRate` rows for the
   requested equipment. This is a fast, indexed lookup — the DB acts as a
   filtered spreadsheet. It runs **no probability math**.
2. **Group in memory.** The backend groups those rows by junk (one junk → several
   rows).
3. **Pure math (the actual calculation).** Per junk, call
   `matchProbabilityForJunk(rows, query)` then `junksNeededForConfidence(P, c)`
   from [`packages/shared/src/domain/dropRateMath.ts`](../packages/shared/src/domain/dropRateMath.ts).
4. **Assemble.** Drop impossible junks, sort by fewest-needed, return.

Nothing is written; it's all read-then-compute. The math module takes plain
numbers in and returns plain numbers out — it has no idea a database exists.

### Why this split

- **Testable without infrastructure.** The formula's unit tests (including the
  Monte-Carlo cross-check) run instantly with hand-made numbers — no Postgres,
  no Docker. If the math lived inside a SQL query or an Express handler, it
  couldn't be exercised that cheaply. The tests are the module's contract: green
  tests mean it does what [`docs/calculation.md`](./calculation.md) says.
- **Reusable.** Living in `shared`, the same functions could recompute values in
  the web-client if we ever wanted to (e.g. a live-updating slider) without
  duplicating the logic.
- **The DB stays dumb on purpose.** Probability math in SQL would be hard to
  read, hard to test, and hard to change. Keeping it in plain TypeScript keeps
  the interesting logic in one small, documented, tested place.

## Performance stance: measure before optimising

The calc is cheap — a sum over a junk's handful of rows — so we deliberately
precompute **nothing** at scrape time and add **no** derived columns for it. The
one denormalisation that already exists (`Equipment.maxDropQuality` /
`maxDropGrade`) is a cheap prefilter, not a precomputed answer.

If profiling on the full dataset (~700 junks) ever shows the read-then-compute
path is too slow, *then* we revisit — e.g. pushing some work into the query or
precomputing at scrape time. Until there's a measured problem: **DB reads, the
math module thinks.**

## Where things live (quick map)

| Concern | Location |
|---------|----------|
| Domain reference data (stats, blessings, gear) | `packages/shared/src/domain/` |
| Drop-rate math (the formula) | `packages/shared/src/domain/dropRateMath.ts` |
| Request/response models (API contract) | `packages/shared/src/api/` |
| DB schema | `packages/backend-api/prisma/schema.prisma` |
| Scraper / seed (writes to DB) | `packages/backend-api/prisma/seed-from-html/` |
| API endpoints (reads DB, calls the math) | `packages/backend-api/src/` |
| UI | `packages/web-client/` |

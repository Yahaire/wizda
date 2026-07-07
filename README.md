# Wizda — A Wizardry Variants Daphne assistant

Wizardry Variants Daphne assistant. It works out how much "junk" need to farm to *guarantee*\* the specific gear you want — so you can do the dull inventory-reversing math once instead of multiple times until you get lucky.

\* — you can choose how likely you want to be to get the item. Not even GREAT Agora can actually guarantee you'll get it!

This project is a monorepo, with the following packages:

- `packages/shared`: Shared code between the web-client and the backend-api
- `packages/backend-api`: API to handle interactions with DB (and the scraper that seeds it)
- `packages/web-client`: Web interface for project

How the packages fit together — and why the core calculation lives in a pure
`shared` module rather than in the DB — is documented in
[`docs/architecture.md`](./docs/architecture.md).

## Dev requirements

- Node 22.x (recommended to use nvm / nvm for Windows)
- Docker Desktop
- Each package may have its own additional requirements

## Running

### First time setup

#### Requirements
- Docker Desktop (must be running)
- A source of drop-rate HTML — either reachable online or a local copy. See
  `JUNK_DROP_RATES_SOURCE_URL` in `.env.example` (e.g.
  `https://wizardry.info/daphne/gacha_rates/en/equipments.html`)

#### Steps
1. Copy `.env.example` to `.env` in the root dir and fill in the variables
2. Open a terminal in the root dir
3. Run `npm install`
4. Run `npx prisma generate`
5. Run `npm run dev:db` to start the PostgreSQL container
6. Run `npm run db:setup` to apply migrations and seed the database

### Debugging

1. Make sure Docker Desktop is running
2. Open a terminal in the root dir and run `npm run dev:db` (starts the container; instant if already set up)
3. Open another terminal in the root dir and run `npm run dev:api`
4. Open another terminal in the root dir and run `npm run dev:web-client`
5. Use a web browser to try the app

#### Resetting DB

1. Run `docker compose down -v` to remove the container and its data volume
2. Run `npm run dev:db` to start a fresh container
3. Run `npm run db:setup` to apply migrations and reseed

#### Schema changes

After editing `schema.prisma`, create and apply a new migration:

```bash
npx prisma migrate dev --name <description>
```

This creates a SQL migration file under `packages/backend-api/prisma/migrations/` and applies it to your local DB.

#### Updating data

When the source pages change or the scraper/seed logic changes, re-run the seed
to update the DB in place (no DB reset needed):

```bash
npm run db:seed:maintenance
```

This sets a maintenance flag before seeding and clears it on success. If the seed
fails, the flag is left in place intentionally — the DB may be in a partial state,
so it's safer to keep the maintenance page up until you fix the issue and re-run.
To clear it manually (e.g. after a killed process):

```bash
rm .maintenance
```

### Standard run

In root dir:

- Run `npm run dev` to run all packages in dev mode
- For only the backend-api: `npm run dev:backend-api`
- For only the web-client: `npm run dev:web-client`

## Testing

Unit tests run with [vitest](https://vitest.dev/). Run the whole suite from the
**root dir**:

- `npm test` — run all tests once
- `npm run test:watch` — re-run on change while developing

Tests live next to the code they cover — e.g. the drop-rate "how much junk?"
calculation in `packages/shared/src/domain/dropRateMath.test.ts` (the math itself
is documented in [`docs/calculation.md`](./docs/calculation.md)).

> Run test commands from the root, not from inside a package — this repo has no
> per-package `test` script, and vitest is configured once at the root.

## Deployment

See [DEPLOY.md](./DEPLOY.md).

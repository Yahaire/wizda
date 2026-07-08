# wizda web-client

Next.js (App Router) web interface for wizda. Part of the monorepo — see the root
README for running (`npm run dev:web-client`).

It's a mobile-and-desktop, dark-themed front-end for casual players: the **Junk
Oracle** (the guarantee calculator) plus searchable **Junk** and **Equipment**
lists. A mascot, **Wizda**, guides the experience through friendly microcopy
(emoji placeholders stand in until real art lands).

## Stack

- **Next.js 15** (App Router, `next dev --turbopack`), **React 19**.
- **[Mantine 8](https://mantine.dev/)** (`@mantine/core`, `@mantine/hooks`,
  `@mantine/notifications`) — components, dark theme, and toasts. Configured via
  PostCSS (`postcss-preset-mantine` + `postcss-simple-vars`, see
  `postcss.config.cjs`).
  - ⚠️ **Pinned to v8 on purpose — do not bump to v9 while Next is `15.5.14`.**
    Mantine 9 calls React 19.2's `useEffectEvent`, which Next 15.5.14's *vendored*
    SSR React doesn't export, so every page 500s with `useEffectEvent is not a
    function`. Upgrade Next first if you want Mantine 9.
- **[@tabler/icons-react](https://tabler.io/icons)** — icon set.
- **[@tanstack/react-virtual](https://tanstack.com/virtual)** — row virtualization
  for the large list/results tables (the tables themselves are a small hand-rolled
  `DataTable`, not a table library — `mantine-react-table` only supports Mantine
  ≤7).
- **[Serwist](https://serwist.pages.dev/)** (`@serwist/next`) — the PWA service
  worker (production builds only).
- Fonts via **`next/font/google`** (self-hosted at build): **Cinzel** (display),
  **Inter** (body), **Caveat** (Wizda's "speech" style).
- No state library — local `useState` + `localStorage` (via Mantine's
  `useLocalStorage`) for the remembered filters.

## Structure

```
src/
  app/
    layout.tsx         root: fonts, MantineProvider (dark), Notifications, Umami <script>
    theme.ts           Mantine theme (crimson primary, tuned dark scale, font vars)
    page.tsx           "/"          → Junk Oracle
    junks/page.tsx     "/junks"     → junk list
    equipment/page.tsx "/equipment" → equipment list
    about/page.tsx     "/about"     → about + data/privacy note
    manifest.ts        PWA web app manifest
    sw.ts              Serwist service worker (excluded from the app tsconfig)
    app.constants.ts   names, tagline, support/data-source URLs
  components/
    Shell.tsx          responsive AppShell (header + collapsible sidebar/burger, max-width body)
    AdSlot.tsx         reserved ad slot — intentionally renders nothing for now
    AboutContent.tsx
    TruncatedText.tsx  single-line text; tooltip only when actually clipped (hover + touch)
    CategoryIcon.tsx   per-gear-type placeholder icon (neutral until categories are seeded)
    oracle/            the Junk Oracle: OraclePage + oracle.logic.ts + filter widgets
                       (EquipmentSelect, FilterField, LevelToggleGroup, BlessingsFilter,
                       CertaintySlider, ResultsPanel)
    lists/             JunkListView, EquipmentListView
    detail/            DetailProvider — shared, cross-linked junk↔equipment detail modals
    gear/              gearDisplays (QualityStars / GradeBadge / grade colours)
    table/DataTable.tsx  reusable virtualized, sortable table (sticky first col, h-scroll)
  mascot/
    wizda.tsx          Wizda's voice: wizdaSay / wizdaConfirm + greeting bank
    WizdaGreeter.tsx   first-visit welcome + once-a-day greeting (mobile-friendly)
  services/
    api.ts             fetch wrapper (typed errors + MaintenanceError)
```

### How it talks to the API

The browser calls same-origin `/api/*`; `next.config.ts` rewrites that to the
backend (`API_URL`), stripping the `/api` prefix — so `/api/junks` →
`GET /junks`. Request/response types are imported straight from the shared
package via `@shared/*` (a single source of truth with the backend). `@wizda/shared`
is in `transpilePackages` so Next compiles its TS (runtime enums/catalogs).

## Key behaviours

- **Junk Oracle** — a custom Combobox equipment picker (pills + loose multi-term
  search — "silver axe" and "axe silver" both find *Silver Two-Handed Axe* — and a
  full-width close button), quality/grade toggle groups, a blessings modal (AND-set,
  capped at 4), and a debounced certainty slider (1–99.99%, default 90%). Every
  filter carries an info (ⓘ) modal and a label-level clear. Filters are
  **reactive**: incompatible quality/grade grey out, and if some were already picked
  a **blocking prompt** offers to clear them or undo the change that caused it.
  Results are virtualized, paged (`Show more`), filterable by name, scroll into
  view on calculate, and each row opens a detail modal; the last selection is
  remembered in `localStorage`.
- **Lag guards** — the backend enforces a result limit and a "≥1 filter" rule; the
  Calculate button is disabled until a filter is set (and nudges you if poked).
- **Lists** — click a column to sort, filter by name (equipment also by tier).
  Virtualized with a sticky first column and horizontal scroll on narrow screens;
  clicking a row opens the **shared detail modals** (`detail/DetailProvider`), which
  cross-link — a junk lists the gear it drops, each piece opens the equipment modal,
  whose sources open the junk modal, and so on.
- **PWA** — installable; the service worker caches the `/api/junks` and
  `/api/equipment` responses (stale-while-revalidate). Never caches the POST
  guarantee query.
- **Analytics (Umami)** — fully env-gated and dormant until configured; see the
  `NEXT_PUBLIC_UMAMI_*` / `UMAMI_*` vars in the root `.env.example`.

## Placeholders to swap before/after launch

- `SUPPORT_URL` in `app.constants.ts` — the real Ko-fi / Buy-Me-a-Coffee link.
- `public/icon.svg` — a temporary "W" mark; replace with real PWA/app icons.
- Umami env vars — provision the two Umami sites (pageviews + API events).

## Troubleshooting

**Editor reports `Cannot find module or type declarations for side-effect import of './globals.css'`?**

The editor is probably using its bundled TypeScript instead of the workspace version. Point it at the workspace TS: Command Palette → "TypeScript: Select TypeScript Version" → "Use Workspace Version". The repo's `.vscode/settings.json` does this automatically on editors that support `js/ts.tsdk.*`.

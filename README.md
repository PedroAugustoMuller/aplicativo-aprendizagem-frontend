# Química 9º Ano — frontend

The Vue 3 PWA for a gamified chemistry quiz for 9th-grade students at
E.M.E.F. Dom Pedro II (Venâncio Aires/RS). Teachers register content and
questions; students answer quizzes with randomised questions, get immediate
feedback, and climb a per-topic ranking.

The API lives in a separate repository, `backend/` (a Laravel app), served
from a different domain. This repository only ever talks to it over HTTPS
through `VITE_API_URL` — there is no server-side code here, just a static
build served by a CDN.

## Requirements

There is **no Node.js on the host**. Every command below runs inside a
container, the same way the sibling `backend/` repository runs everything
through `docker compose exec`. You need:

- Docker and Docker Compose.
- The backend repository checked out as a sibling directory (`../backend`).
  `sync:error-codes` only needs that checkout to exist with
  `docs/error-codes.json` present in it — it copies a file off a read-only
  bind mount, no server involved (see `BACKEND_DOCS` / `BACKEND_ERROR_CODES`
  below if your checkout isn't a sibling). The dev server's API calls and the
  end-to-end suite need the backend actually **running, migrated, and
  seeded** at `http://localhost:8080`. Unit tests and the
  TypeScript/lint/architecture checks need neither the checkout nor a running
  backend.

`docker-compose.yml` defines three services:

- **`dev`** (`node:22-bookworm-slim`) — the only service `docker compose up`
  starts. It runs `npm install` when `node_modules` is missing or older than
  `package-lock.json`, then the Vite dev server on port 5173.
- **`node`** (same image, profile `tools`) — one-off commands via
  `docker compose run --rm node npm run <script>`: install, build, quality
  gate, unit tests, error-code sync, icon generation. It sits behind a
  profile so `up` never starts it (without a command it would just open an
  idle Node REPL).
- **`e2e`** (`mcr.microsoft.com/playwright:v1.62.1-noble`, profile `e2e`) —
  `docker compose up e2e` runs the end-to-end suite and exits. A bare `up`
  never starts it. Its image bundles the Playwright browsers and their system
  libraries, so `playwright install` never runs anywhere in this project.
  `@playwright/test` in `package.json` is pinned to exactly `1.62.1` to match
  the image tag — **the two must move together**, or Playwright refuses to run
  against browsers it didn't build.

`dev` and `e2e` both start through `scripts/with-deps.sh`, which runs
`npm install` when `node_modules` is missing or older than
`package-lock.json` and then hands off to the service's command, so either
works on a fresh checkout.

All services run as uid/gid 1000 (`user: "${UID:-1000}:${GID:-1000}"`) so
files written into the bind-mounted repo stay owned by you, not root. If your
host user isn't uid 1000, export `UID`/`GID` before running Compose. All use
`network_mode: host`: the dev server and the production preview must be
reachable at `http://localhost:5173` from your host browser, and the
container must reach the backend at `http://localhost:8080` — host
networking gives both without setting up a bridge network.

## Getting started

```bash
cp .env.example .env
docker compose run --rm node npm run sync:error-codes
docker compose up
```

The first `up` installs dependencies before starting Vite; later ones go
straight to the dev server. Open `http://localhost:5173` and sign in with the
seeded teacher, `ana@escola.br` / `password`. Stop it with Ctrl+C, or use
`docker compose up -d` to run it in the background and `docker compose down`
to stop it.

If you want to run the quality gate or tests before ever running `up`, install
first with `docker compose run --rm node npm install`.

## Commands

Run any of these as `docker compose run --rm node npm run <script>`:

| Script | What it does |
| --- | --- |
| `dev` | Starts the Vite dev server on port 5173 — normally via `docker compose up` instead. |
| `build` | `vue-tsc -b && vite build`; emits `dist/`. |
| `preview` | Serves the built `dist/` on port 5173 (`--strictPort`). |
| `test:unit` | Runs the Vitest suite once. |
| `test:watch` | Runs Vitest in watch mode. |
| `test:e2e` | Runs Playwright — use `docker compose up e2e` instead (see below). |
| `lint` | ESLint over the whole project. |
| `typecheck` | `vue-tsc -b` (see the note in "Quality gate" below). |
| `arch` | dependency-cruiser against `src/`, using `.dependency-cruiser.cjs`. |
| `sync:error-codes` | Copies the backend's `error-codes.json` into `src/shared/i18n/`. |
| `icons` | Regenerates the placeholder PWA icons under `public/icons/`. |
| `quality` | `typecheck` → `lint` → `arch` → `test:unit`, in that order. |

### End-to-end tests

```bash
docker compose up e2e
```

The container prints the results and exits. `docker compose up` exits 0 even
when tests fail; in a script or CI, use
`docker compose up e2e --exit-code-from e2e` so a failure fails the command.

Runs against the real backend, on both the `desktop` and `mobile` Playwright
projects. A few things that make this suite different from a normal `npm run
test:e2e`:

- **Stop the dev server first** (`docker compose down`). The suite's `webServer` runs
  `npm run build && npm run preview` on port 5173 with
  `reuseExistingServer: false`, and fails loudly if that port is already
  taken. Port 5173 is also the only origin the backend's CORS config allows,
  which is why both the dev server and the production preview use it instead
  of Vite's default 4173.
- **Login budget.** The backend throttles `POST /auth/login` to 5 attempts
  per minute per email+IP. This suite spends 4 per run: one API login in
  `e2e/global-setup.ts` (shared as `storageState` by every test), a
  sign-in/sign-out journey run on both projects, and a wrong-password test
  run on `desktop` only. The two login-issuing tests run with retries
  disabled — a retry would spend another attempt and, on a genuine 429,
  cascade past the budget. **Wait 60 seconds between runs.** A 429 raised
  from `globalSetup` says so explicitly. If you add a test that logs in,
  revisit the budget comment at the top of `e2e/auth.spec.ts` first.
- Never run `playwright install`; the `e2e` service's image already has the
  browsers baked in, matched to the pinned `@playwright/test` version.

## Architecture

```
src/
  modules/<module>/
    domain/           entities and repository interfaces — no framework imports
    application/      stores/use-cases orchestrating the domain
    infrastructure/
      client/          HTTP routes and request builders
      interfaces/      network-shaped types (API response DTOs)
      persistence/      future offline (IndexedDB) adapters
    presentation/      Vue components and pages
  shared/
    api/               fetch transport, HTTP client, error types
    i18n/              vue-i18n setup, locales, error-code catalogue
    router/            the Vue Router instance; guard.ts holds the session guard
                       and the onUnauthorized handler
    theme/             dark-mode composable
    ui/                the app shell (AppLayout)
```

The current modules are `identity` (login, session) and `content` (topics).
`Quiz` and `Scoring` will follow the same shape when they land.

The domain sits behind a repository **interface** (`AuthRepository`,
`TopicRepository`), and only `infrastructure/` implements it against HTTP
today. Nothing is injected yet: each store imports the concrete HTTP
repository instance (exported typed as the interface). So when an
IndexedDB-backed adapter lands in `infrastructure/persistence/` for offline
support (RNF03), swapping it in changes **one import line in each store**;
pages and domain types are untouched, because the repository contract does
not change.

Listings intentionally skip the write-side aggregate: `HttpTopicRepository`
maps the list endpoint straight into `Topic` DTOs, because a list view has
no aggregate invariants to protect.

These boundaries are enforced by machine, not by convention:
dependency-cruiser (`npm run arch`, part of `quality`) fails the build if:

- `domain/` imports anything but its own module's `domain/` folder — it is
  an allow-list, so no npm package (`vue`, `@vueuse/core`, ...) and nothing
  from `src/shared/` either.
- one module imports another module's internals (only `src/shared/` may be
  shared).
- `presentation/` imports `infrastructure/` directly — components must go
  through a store or composable.
- `application/` imports `presentation/`.
- anything other than a module's `infrastructure/`, `src/main.ts`, or
  `src/shared/api/` itself imports `src/shared/api/{client,http,transport,adapters}.ts`
  — a page or store calling `api.get` would bypass the repository.
  `ApiError` and `src/shared/api/types/` remain importable.
- anything under `src/shared/` other than `shared/router/` or `shared/ui/`
  imports a module — those two are the app's composition roots, so they are
  the only place in `shared/` allowed to know modules exist, and they may
  reach only a module's `application/` and `presentation/`.
- `src/shared/api/` imports `src/shared/router/` or `vue-router` — the
  transport is constructed with an injected `onUnauthorized` callback
  precisely so it never needs the router; `src/main.ts` is what decides what
  "unauthorized" means (see `configureApiSession` there).
- there is a circular dependency anywhere in `src/`.

Type-only imports (`import type`) are part of the graph
(`tsPreCompilationDeps: true`), so they are held to the same rules.

## Sessions and offline

The session store distinguishes `hasSession` (a token is stored) from
`isAuthenticated` (the server has also confirmed it). The router guard and
the app shell gate on `hasSession`:

- On a reload, the guard calls `restore()` (`GET /auth/me`). Only a **401**
  discards the token; the guard then sends the user to
  `/login?redirect=<target>&reason=expired`, and the login page shows the
  expiry notice.
- Offline, a timeout, or a server error keep the token: the student stays
  inside the installed PWA and the page shows its own error with a retry.
  `restore()` is retried on the next navigation to a different route.
- The transport calls `onUnauthorized` only for a 401 on a request that
  carried a token — a wrong password is a 401 on the anonymous login POST,
  not an expired session. The handler (`createUnauthorizedHandler` in
  `src/shared/router/guard.ts`) always clears the session, but navigates to
  `/login?reason=expired` only when the current route requires auth; on first
  load the guard alone owns the redirect.

## Adding a module

1. Create `src/modules/<name>/{domain,application,infrastructure/{client,interfaces,persistence},presentation}`.
2. Add its routes to `src/shared/router/index.ts`, with `meta.requiresAuth` /
   `meta.guestOnly` as appropriate.
3. Run `docker compose run --rm node npm run arch` — dependency-cruiser will
   fail loudly the moment a boundary above is crossed.

## Errors and i18n

The API never returns user-facing text — only a stable error `code` (plus
`params`). `apiErrorMessage(error, t, te)` in
`src/shared/i18n/apiErrorMessage.ts` is the **only** approved path from an
`ApiError` to something rendered on screen; nothing else should read
`error.message`.

`src/shared/i18n/error-codes.json` is the catalogue synced from the backend
(see `scripts/sync-error-codes.mjs`). After the backend adds or changes an
error code:

```bash
docker compose run --rm node npm run sync:error-codes
```

then add the matching key under `errors.` in **both**
`src/shared/i18n/locales/pt-BR.ts` and `.../en.ts` — `errorCatalogue.spec.ts`
fails the build if a synced code has no translation in either locale.

Three codes are client-originated and deliberately never appear in the
synced catalogue, so they're maintained by hand:
`api.network_unavailable`, `api.request_timeout`, `api.unexpected_response`.

Inside the `node` container (only that one — the `e2e` service has no
backend mount), the backend's `docs/` directory is mounted read-only at `/backend/docs` via `${BACKEND_DOCS:-../backend/docs}`
in `docker-compose.yml` — that variable is read only by Docker Compose,
never by Vite. The default is correct once this repository sits as
`frontend/`, a sibling of `backend/`; override it in a local `.env` (never
committed) if your checkout is laid out differently. The sync script itself
also accepts `BACKEND_ERROR_CODES` (an absolute path) to point at a different
`error-codes.json` inside the container.

## Quality gate

```bash
docker compose run --rm node npm run quality
```

Runs, in order: `vue-tsc -b` → ESLint → dependency-cruiser → Vitest. All four
must pass before any work is considered done.

Notes for maintainers:

- **Typecheck is `vue-tsc -b`, not `--noEmit`.** The root `tsconfig.json` is
  a project-references shell with no `compilerOptions` of its own — running
  `vue-tsc --noEmit` against it checks zero files and reports success.
  `-b` (build mode) is what makes it actually follow the references into
  `tsconfig.app.json` (`src/**/*.{ts,tsx,vue}`) and `tsconfig.node.json`
  (`vite.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `e2e/**/*.ts`).
- Strictness lives in those two leaf configs: `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `erasableSyntaxOnly` (which forbids TypeScript parameter properties, since
  those can't be erased to plain JavaScript without emitting code). When
  `exactOptionalPropertyTypes` complains about an optional field, widen its
  type with `| undefined` — never relax the flag or reach for a cast.
- Vitest specs that mount real Vuetify components depend on
  `test.server.deps.inline: ['vuetify']` in `vite.config.ts`. Vuetify's ESM
  build ships `.css` side-effect imports; without that setting, vite-node
  treats vuetify as an external module and hands those imports to Node's
  loader, which can't parse CSS.

## UI

- Every screen must work on a phone and on a desktop from the same component
  tree — use Vuetify's `useDisplay()` to switch layout, never a separate
  mobile component. `src/shared/ui/AppLayout.vue` is where the rail
  (desktop) vs. bottom navigation (mobile) split lives.
- `LoginPage.vue`'s submit button uses `@click.prevent`, not a plain
  `@click`: without `.prevent`, a click both fires the handler and lets the
  native form submission through, which POSTs the login request twice. Unit
  tests can't see this (there's no real form submission in happy-dom the
  same way); the end-to-end sign-in journey counts login requests and would
  catch a regression.
- Icons are inline SVG. `src/plugins/vuetify.ts` configures Vuetify's
  `mdi-svg` icon set, and components pass path constants imported from
  `@mdi/js` (e.g. `:icon="mdiLogout"`), so only the icons actually used end up
  in the bundle and no icon webfont ships to students' phones. An `mdi-*`
  string renders blank — there is no icon font. Vuetify's own internal icons
  (alert types, etc.) come from the `mdi-svg` aliases.
- Both light and dark palettes are defined explicitly in
  `src/plugins/vuetify.ts`; dark mode follows the system preference by
  default and remembers a manual override (`src/shared/theme/useAppTheme.ts`).

## PWA icons

`public/icons/*.png` (the PWA manifest icons) are generated by
`scripts/generate-icons.mjs`, which draws a flask glyph and encodes PNGs
using only Node built-ins — no image library. They are placeholders for real
artwork; regenerate them with:

```bash
docker compose run --rm node npm run icons
```

## Environment variables

`VITE_API_URL` is the only variable the app reads (typed in `src/env.d.ts`).
Anything prefixed `VITE_` is inlined into the built bundle and shipped to the
browser — **never** put a secret in one.

## Deployment

The production build is static output — `dist/` — with no server-side code
of its own. It's deployed to Vercel (Hobby plan): Vercel detects the Vite
project automatically, deploys on every push to the main branch (or via
`npx vercel deploy --prod`), and serves `dist/` over HTTPS, which the PWA
service worker requires. The only environment variable to configure there is
`VITE_API_URL`, pointed at the backend's public URL.

The router uses HTML5 history mode, so a deep link or a reload on `/topics`
asks the CDN for a file that does not exist. `vercel.json` rewrites every
path that isn't a real file in `dist/` to `/index.html` so the client-side
router can take over (Vercel serves existing static files before applying
rewrites). Any other host needs the same SPA fallback.

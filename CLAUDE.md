# Frontend — working agreements

## Non-negotiable

- **Commit after every completed task**, once `docker compose run --rm node npm run quality` passes.
  Match the existing history: a single lowercase conventional-commit line
  (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`), authored by the user's
  git identity. **No AI attribution** — no `Co-Authored-By:` trailer, no
  "Generated with" line, nothing that marks the commit as AI-written.
  Design specs and implementation plans do not live here: they are written
  and committed in the parent workspace repository
  (`../docs/superpowers/{specs,plans}/`), see the root `CLAUDE.md`.
- **Everything runs in Docker:** `docker compose up` for the dev server,
  `docker compose up e2e` for the end-to-end suite, and
  `docker compose run --rm node npm run <script>` for one-off commands.
  `node` and `e2e` sit behind Compose profiles on purpose — do not remove
  them, or a bare `up` also starts an idle REPL and a full e2e run (which
  spends the backend's login budget). Never run `npm`, `node`, or `npx` on the host — nothing is
  installed there.
- **`docker compose run --rm node npm run quality` must pass before any
  work is called done.** It runs, in order: `vue-tsc -b`, ESLint,
  dependency-cruiser, and Vitest.
- **No `any`.** Use `unknown` and narrow. `@typescript-eslint/no-explicit-any`
  is set to `error`, not warn.

## Architecture

- One folder per bounded context: `src/modules/<module>/{domain,application,infrastructure,presentation}`.
- `domain/` is an allow-list: a domain file may import **only** its own
  module's `domain/` folder — no npm package (not even `vue` or
  `@vueuse/core`), nothing under `src/shared/` (not even `ApiError`), no
  other layer. dependency-cruiser fails the build otherwise, and type-only
  imports (`import type`) count.
- `application/` never imports `presentation/`.
- `infrastructure/client/` holds routes and requests; `infrastructure/interfaces/`
  holds **network** shapes (the API's DTOs); the repository maps network
  shapes to domain types. Never let an API field name leak into the domain —
  that mapping is why a backend contract change touches one file.
- Offline **reads** go through `readThrough` in `src/shared/offline/` — one
  generic, per-user IndexedDB cache wired in `main.ts` (`configureOffline`),
  wiped when the session ends. Offline **writes** (the future quiz-answer
  queue) will live in each module's `infrastructure/persistence/`. The HTTP
  repositories are exported typed as the domain interface and each store
  imports that concrete instance directly — there is no injection yet.
- A module that needs the viewer's role but must not import `identity` uses
  `useViewerRole()` (`src/shared/auth/viewer.ts`), wired in `main.ts`.
- Routes may set `meta.roles`; the guard sends a known user with another role
  to `/subjects`. Hiding is convenience — the backend answers 403 anyway.
- Only a module's `infrastructure/` (and `src/main.ts`, the composition root)
  may import `src/shared/api/{client,http,transport,adapters}.ts`. Pages and
  stores never call `api.get` themselves. `ApiError` (`shared/api/error.ts`)
  and `shared/api/types/` are importable from anywhere outside `domain/`.
- Components talk to stores and composables, never directly to a request or
  repository. dependency-cruiser's `presentation-does-not-reach-infrastructure`
  rule fails the build otherwise.
- Shared code lives in `src/shared/`; nothing under it may import from
  `src/modules/` **except** `src/shared/router/` and `src/shared/ui/` — those
  two are the app's composition roots (the router assembles routes out of
  page components; the app shell lays them out), so they're the one place in
  `shared/` allowed to know modules exist, and even they may reach only a
  module's `application/` and `presentation/` — never its `domain/` or
  `infrastructure/` (their specs included: mock a repository by path with
  `vi.mock`, don't import it).
- A module never imports another module's internals — only `src/shared/`.

## Errors and i18n

- The API returns **codes**, never user-facing text. `apiErrorMessage(error, t, te)`
  (`src/shared/i18n/apiErrorMessage.ts`) is the only way an error reaches the
  screen. Never render `error.message`.
- Stores and pages hold an `ApiError`, not a translated string, and derive
  the message with `computed()` (see `TopicsPage.vue`, `LoginPage.vue`), so a
  language change re-renders the current error correctly.
- After the backend adds an error code: `docker compose run --rm node npm run
  sync:error-codes`, then add the key under `errors.` in **both**
  `src/shared/i18n/locales/pt-BR.ts` and `en.ts`. `errorCatalogue.spec.ts`
  enforces this — it fails if any synced code is missing a translation in
  either locale.
- Client-side failures (`api.network_unavailable`, `api.request_timeout`,
  `api.unexpected_response`) never appear in the synced catalogue — keep
  their translations by hand.

## HTTP

- The transport knows nothing about the router. On a 401 to a request that
  **carried a token** it calls the injected `onUnauthorized`; a 401 on an
  anonymous request (a wrong password on the login POST) is just an error
  for the caller. `src/main.ts` wires `onUnauthorized` to
  `createUnauthorizedHandler` (`src/shared/router/guard.ts`). Do not import
  the router (or `vue-router`) into `src/shared/api/` — the
  `transport-does-not-know-routing` dependency-cruiser rule fails the build
  otherwise.
- `VITE_API_URL` is the only API configuration (typed in `src/env.d.ts`).
  Never hardcode a URL. Never put a secret in a `VITE_` variable — it ships
  in the built bundle.

## Session

- `hasSession` = a token exists; `isAuthenticated` = the server has also
  confirmed it and the user is known. **Navigation and the app shell gate on
  `hasSession`**, so a reload of the installed PWA while offline stays inside
  the app and the page shows its own retry.
- `restore()` discards the token **only** when the server answers 401
  (outcome `rejected`). Offline, a timeout or a 5xx keep it (`unavailable`);
  the guard retries `restore()` on the next navigation to a different route
  while the user is still unknown.
- `onUnauthorized` always clears the session, but navigates to
  `/login?reason=expired` only when the **current** route requires auth. On
  first load the current route is `START_LOCATION`, so the guard alone owns
  that redirect: it sends `/login?redirect=<target>&reason=expired` when
  `restore()` rejected the token. Two competing pushes there would drop the
  notice. `src/shared/router/guard.spec.ts` covers each branch against a real
  memory-history router.
- `knownUser` = the confirmed user, else the one remembered from the last
  confirmation (localStorage `dp2.auth.user`, never the token). Use it only
  for the menu and offline cache keys; access decisions use `user`.

## Writes and retries

- Any write endpoint the client may resend must accept a client-generated
  identifier (`attempt_id`) and return the **original** result on replay
  instead of duplicating the write. No retryable write exists in this
  codebase yet, but the offline queue that will live in
  `infrastructure/persistence/` depends on every future one following this
  convention from the start — a student's phone will resend a quiz-attempt
  submission the moment the network comes back (RNF03/RNF05), and a
  duplicate submission is a wrong score, not a cosmetic bug.

## UI

- Every screen must work on a phone and on a desktop. Use Vuetify's
  `useDisplay()`; do not write separate mobile components.
- Prefer Vuetify components and its spacing utilities over custom CSS.
- Add `data-testid` to anything an end-to-end test needs to reach.
- Both light and dark palettes are defined explicitly in
  `src/plugins/vuetify.ts`. Check contrast in both — the audience is
  14-year-olds on cheap phone screens (RNF06).
- Icons are inline SVG: Vuetify runs the `mdi-svg` icon set, and components
  pass path constants imported from `@mdi/js` (`:icon="mdiLogout"`). Never
  use an `mdi-*` string — no icon font is shipped, so it renders blank.
- Don't remove `.prevent` from a form submit button's `@click` without
  checking why it's there first (see `LoginPage.vue`): without it, a click
  fires the handler and the form's native submission, doubling the request.

## Testing

- `vitest.setup.ts` stubs `VDialog` so dialog content renders in place; test
  dialogs through their `data-testid`s.
- In `.vue` files reach browser APIs through `globalThis` (`globalThis.crypto`,
  `globalThis.print`, `globalThis.location`): ESLint's `no-undef` applies to
  `.vue` files and no browser globals are configured.
- dependency-cruiser's `domain-is-pure` covers spec files too: test a domain
  function from an `application/` spec (see `application/roster.spec.ts`).
- e2e: wait for an autofocused field to have focus before filling a form, and
  for `navigator.serviceWorker.ready` before going offline.
- Vitest specs that mount real Vuetify components rely on
  `test.server.deps.inline: ['vuetify']` in `vite.config.ts`. If a new spec
  mounting Vuetify fails with a CSS-parsing error from vite-node, check that
  setting first.
- End-to-end tests run in the `e2e` service, against the real backend, on
  both the `desktop` and `mobile` Playwright projects — never against a
  concurrently running dev server (stop it first with `docker compose down`; the suite builds and
  serves the production bundle itself on port 5173).
- The backend throttles login to 5/minute per login+IP; the suite already
  spends 4 of those per run. Read the login-budget comment at the top of
  `e2e/auth.spec.ts` before adding any test that submits the login form, and
  never give a login-issuing test retries. Global setup also resets
  `diego.souza` via `POST /students/{id}/reset-password` (no login spent); the
  password-change journey logs in as Diego once, desktop only, in his own
  throttle bucket.

## Language

- All code, identifiers, comments, and documentation in **English**.
- Portuguese exists only as:
  - values in `src/shared/i18n/locales/pt-BR.ts`;
  - user-facing PWA/document metadata: the manifest values in
    `vite.config.ts` and the `<title>` in `index.html`;
  - test fixtures and assertions of translated or seeded text (e.g.
    `'E-mail/usuário ou senha incorretos.'` in specs, `'Matéria e suas
    Transformações'` in e2e);
  - seeded subject and topic content on the backend side.

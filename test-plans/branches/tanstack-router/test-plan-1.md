# Test plan 1 — React Native routing shim MVP

Bead: `springboard-hob` — Plan React Navigation RN routing shim for Springboard modules

Branch: `tanstack-router`

## Approval status

Pending user approval of this test plan before implementation starts.

## User story

As a Springboard module author, I want to define routes once through Springboard's
platform-neutral router API so the same route definitions work on the existing
web TanStack Router host and on a new React Native React Navigation host.

The feature works when:

- userland can import `defineRoute`, `defineRoutes`, `useNavigate`,
  `useParams`, `useSearch`, and `getRouteApi` from `springboard/router`;
- supported MVP routes (`/`, static paths, `$param` dynamic paths, and
  validated search params) are type-safe at compile time;
- web routing still behaves through TanStack Router;
- RN routing renders through React Navigation native stack;
- duplicate paths fail loudly during route collection;
- navigation/hook resolution fails loudly if a compile-time route is not present
  in the loaded runtime descriptor registry.

Constraints:

- Follow the reviewed implementation plan in
  `notes/001-tanstack-router-rn-implementation-plan.md`.
- Practice TDD where practical.
- Remove `moduleAPI.registerRoute` entirely for this branch. Modules should use
  `defineRoute` / `defineRoutes` and `springboard/router` only for UI routes.
- Defer descriptor screen options unless required by tests/examples.
- Do not add a `useQuery` alias in MVP; use `useSearch` only.
- Do not consider the feature mergeable until the feature-complete MVP
  acceptance slice passes.

## High-level manual and automated test cases

### TEST_CASE_1A — `springboard/router` resolves from a consumer package

Steps:

1. From a consumer package or fixture, import:
   - `defineRoute`
   - `defineRoutes`
   - `useNavigate`
   - `useParams`
   - `useSearch`
   - `getRouteApi`
2. Run the focused typecheck command for that consumer/fixture.
3. Verify the Springboard core package publishing config includes the root-level
   `router` entrypoint.

Expected:

- TypeScript resolves `springboard/router`.
- Runtime/package resolution does not require private source paths.
- No `useQuery` export is required or documented for MVP.

Error coverage:

- Importing an intentionally missing router export fails at typecheck.
- Removing the package `files`/path config for `router` causes the consumer
  resolution test to fail.

### TEST_CASE_2A — Route descriptor type safety matches the MVP contract

Steps:

1. Add or run compile-time tests for `Register.routes` declaration merging.
2. Define routes for `/`, `/settings`, and `/songs/$songId`.
3. Add a validated search example for `/songs/$songId`.
4. Assert valid uses compile:
   - `navigate({to: '/songs/$songId', params: {songId: 'abc'}})`
   - `navigate({to: '/songs/$songId', params: {songId: 'abc'}, search: {tab: 'lyrics'}})`
   - `useParams({from: '/songs/$songId'})`
   - `useSearch({from: '/songs/$songId'})`
   - `getRouteApi('/songs/$songId').useParams()`

Expected:

- Path params are inferred from `$param` segments.
- Search type is inferred from `validateSearch`.
- Unvalidated search remains appropriately loose/unknown rather than pretending
  to be typed.

Error coverage:

- Missing required path params fail at compile time.
- Extra path params fail where practical.
- Wrong search values fail when `validateSearch` provides a precise return type.
- Unknown `to` or `from` route paths fail at compile time.
- `useQuery` use fails or is absent for MVP.

### TEST_CASE_3A — Route collection detects duplicate routes deterministically

Steps:

1. Register two modules that both declare the same normalized path, such as
   `/settings`.
2. Trigger route collection.
3. Register paths that normalize to the same derived internal ID, if distinct
   examples exist.

Expected:

- Route collection throws before rendering.
- The error identifies the duplicate path and enough module/route context to fix
  the conflict.
- The derived internal route/screen ID is stable across repeated runs.

Error coverage:

- Duplicate `/` routes fail clearly.
- Duplicate dynamic route patterns fail clearly.
- Derived ID collision fails even if raw paths differ.

### TEST_CASE_4A — Web adapter preserves existing TanStack-host behavior

Steps:

1. Convert a representative existing test route to the new descriptor API.
2. Start or run the focused web routing test path.
3. Navigate to `/`, a static route, and a dynamic route with validated search.
4. Read params/search through `springboard/router` hooks.

Expected:

- Web routes are compiled to TanStack routes.
- Existing web route rendering continues to work.
- `useNavigate`, `useParams`, `useSearch`, and `getRouteApi` return the expected
  behavior through TanStack on web.

Error coverage:

- Invalid search input is normalized or rejected according to `validateSearch`.
- Navigation to a route typed in the app registry but missing from loaded runtime
  descriptors throws during navigation/hook resolution, not route collection.
- Browser-specific behavior not in MVP is not required for this test.

### TEST_CASE_5A — RN host renders and navigates through React Navigation

Steps:

1. Mount the Springboard-owned RN host with representative descriptors for:
   - `/`
   - `/settings`
   - `/songs/$songId`
2. Verify the host owns `NavigationContainer` by default.
3. Verify the generated stack can be imported or mounted as an embeddable child
   boundary for future app-provided containers.
4. Navigate from `/` to `/songs/$songId` with params and validated search.
5. Read params/search in the screen through `springboard/router`.

Expected:

- The RN route renders via React Navigation native stack.
- Screen component identity is stable; route changes do not remount purely
  because a new inline component factory was created during render.
- React Navigation params stay serializable.
- Springboard remains the source of route truth.

Error coverage:

- Navigation to a route missing from the runtime descriptor registry throws a
  clear runtime error during navigation/hook resolution.
- Invalid or missing dynamic params fail before navigating, or render a clear
  error if the invalid state comes from an external deep link.
- Invalid search input follows the route's `validateSearch` behavior.

### TEST_CASE_6A — modules use `defineRoute` / `defineRoutes` only

Steps:

1. Rewrite representative existing module route registrations to use
   `defineRoute` / `defineRoutes`.
2. Verify modules expose routes through descriptor values and import route hooks
   from `springboard/router`.
3. Run a grep/typecheck over active source files for `moduleAPI.registerRoute`.
4. Exercise web or RN rendering for a migrated route.

Expected:

- Active modules use `defineRoute` / `defineRoutes` for supported MVP UI routes.
- `moduleAPI.registerRoute` is not exposed as a non-deprecated, transitional,
  deprecated, or descriptor-backed convenience wrapper.
- Attempted old `moduleAPI.registerRoute` usage fails clearly at typecheck, or
  throws an actionable runtime error only if an unavoidable migration shim exists.
- Direct raw TanStack imports are not required for cross-platform modules.

Error coverage:

- Unsupported route options fail clearly or are documented as reserved/deferred.
- Duplicate paths between migrated descriptors fail during collection.
- Any remaining active `moduleAPI.registerRoute` call sites fail the test.

### TEST_CASE_7A — Deferred features remain explicitly out of scope

Steps:

1. Check implementation docs/API comments for deferred features:
   - nested layouts/outlets
   - splats
   - loaders
   - route guards
   - route masks
   - `useQuery` alias
   - full screen-options support
2. Attempt to use at least one deferred feature in a type or runtime fixture if
   practical.

Expected:

- Deferred features are not silently accepted as if supported.
- Failures are clear and low-surprise.
- MVP tests/examples do not rely on deferred features.

Error coverage:

- Unsupported features fail at typecheck where practical.
- Runtime-only unsupported input fails with an actionable message.

## Agent-driven browser workflow

This feature is primarily package/type/runtime infrastructure, so browser-driven
testing is only required if the implementation changes a browser-visible web
route or demo.

If browser testing becomes necessary, use the Playwright CLI snapshot/ref loop
from the shared onboarding process:

```bash
PW_SESSION='tanstack-router-rn-routing'

pnpm playwright:cli -s="$PW_SESSION" open "$URL"
pnpm playwright:cli -s="$PW_SESSION" snapshot --json
pnpm playwright:cli -s="$PW_SESSION" click e<N> --json
pnpm playwright:cli -s="$PW_SESSION" fill e<N> "value" --json
```

Record exact URLs, commands, snapshot paths, generated locator hints, screenshot
paths, and observed results on the implementation or QA bead. Do not commit
`.playwright-cli/` artifacts.

## Required automated checks

The implementer should run focused checks that cover changed packages. At
minimum, record the exact commands used for:

- route type tests;
- router package import/typecheck fixture;
- route matching/path interpolation/search validation unit tests;
- web adapter tests;
- RN adapter tests or component tests;
- repo typecheck/lint/test commands required by the implementation plan.

If an expected command is unavailable or too broad/slow, record the reason and
the narrower substitute used.

## Implementation result recording

The implementer and independent tester should record results as JSON keyed by
test-case IDs on `springboard-hob` — Plan React Navigation RN routing shim for
Springboard modules or a linked implementation/QA bead.

Example:

```json
{
  "TEST_CASE_1A": {"status": "PASS"},
  "TEST_CASE_2A": {"status": "PASS"},
  "TEST_CASE_3A": {"status": "PASS"},
  "TEST_CASE_4A": {"status": "PASS"},
  "TEST_CASE_5A": {"status": "PASS"},
  "TEST_CASE_6A": {"status": "PASS"},
  "TEST_CASE_7A": {"status": "PASS"}
}
```

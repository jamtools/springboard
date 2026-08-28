# Test Plan 2 — Async route components, RN WebView fallback resolver, and mobile-e2e demo

Bead: `springboard-hob` — **Plan React Navigation RN routing shim for Springboard modules**.

Status: **planned / pending review**. Do not treat any test case as passing until implementation runs it.

Follow-up config/templateization bead: `springboard-ze4` — **Plan springboard_config schema and templateization separately**.

## Scope

This test plan covers the next routing implementation pass after the approved descriptor-router MVP:

- explicit `asyncRouteComponent` support;
- synchronous component support remains valid;
- route metadata collection stays synchronous;
- `asyncDefineRoute` remains excluded;
- explicit platform selector map: `asyncRouteComponent({ browser, reactNative })`;
- safe `undefined` absent-component behavior for missing platform branch only;
- Vite/plugin recognition when needed so inactive platform branch imports do not break or bundle into active platform builds;
- current route first + background-load rest strategy;
- RN-only WebView fallback for absent native components;
- sync/async app-provided WebView target resolver contract;
- minimal remote/local WebView target union;
- browser missing component hard errors;
- `apps/mobile-e2e` mixed native/WebView-backed descriptor routing demo;
- Expo/app-owned scheme and `linkingPrefixes` wiring.

Out of scope:

- `springboard_config` schema;
- config file location/validation;
- codegen/template generation;
- local bundle asset mapping policy;
- `runOnSwitch` helper;
- manual `springboard.runOn(...)` loader as the primary MVP API;
- raw TanStack route objects as the cross-platform route API;
- `moduleAPI.registerRoute` / `moduleAPI.ui.registerRoute`;
- `useQuery` alias.

## Required preconditions

- Existing test-plan-1 routing MVP remains green.
- `registerRoute` APIs remain removed.
- Web adapter remains TanStack-backed.
- RN adapter remains React Navigation-backed.
- Current branch/worktree is the implementation destination; weekly branch is not edited directly.

## TEST_CASE_8A — asyncRouteComponent does not make route metadata async

**Goal:** prove async component loading is explicit and does not make route collection asynchronous.

Steps:

1. Define a route with a plain sync component.
2. Define a route with `asyncRouteComponent`.
3. Collect descriptors synchronously.
4. Assert duplicate path / derived ID detection still runs during route collection.
5. Type-test that params/search inference still comes from `defineRoute` / `validateSearch`.
6. Type-test that `asyncDefineRoute` is not exported.
7. Type-test or runtime-test that a raw Promise component is not silently accepted by guessing at runtime.

Expected:

- descriptor collection does not await component imports;
- sync and explicit async components both compile;
- route type inference remains unchanged;
- duplicate path / ID failures still occur at collection time.

Error coverage:

- raw Promise-as-component is rejected or clearly errors;
- route metadata cannot be provided by async callback.

## TEST_CASE_9A — asyncRouteComponent map supports conditional route components safely

**Goal:** prove the selected platform branch is explicit and `undefined` is only an absent-platform signal.

Steps:

1. Define a route with `asyncRouteComponent({ browser, reactNative })`.
2. Define a browser-only route with no `reactNative` key.
3. On RN, assert the missing `reactNative` key is classified as absent native component.
4. On browser, assert the browser branch loads/renders normally.
5. Define a route whose selected `reactNative` loader resolves to `undefined`.
6. Assert selected loader returning `undefined` is a hard error and does not trigger WebView fallback.
7. Define a route whose selected import resolves but named export is `undefined`.
8. Assert missing selected export is a hard error.
9. Type-test that `rn`, `mobile`, and quoted `"react-native"` are not the primary MVP platform keys.

Expected:

- missing active platform key is the only allowed `undefined` absent-component signal;
- selected loader/import returning `undefined` is treated as a developer bug;
- `reactNative` is the RN platform key covered by public type tests.

Error coverage:

- selected loader throws/rejects;
- selected loader returns non-component;
- selected sync branch is explicitly `undefined`;
- browser route with no browser branch hard-errors.

## TEST_CASE_9B — inactive platform imports do not break active-platform builds

**Goal:** prove Vite/plugin recognition or existing conditional-compilation behavior is sufficient for merge.

Steps:

1. Add a focused fixture route using `asyncRouteComponent({ browser, reactNative })`.
2. Put an import in the inactive branch that would fail if evaluated/bundled/typechecked for the active platform.
3. Run the focused browser-side build/typecheck/plugin test.
4. Run the focused RN-side build/typecheck/plugin test, or the nearest existing repository check that exercises the RN transform path.
5. Inspect the emitted/transformed output where practical to prove inactive branch imports are removed or not bundled incorrectly.

Expected:

- inactive `reactNative` branch imports do not break browser checks;
- inactive `browser` branch imports do not break RN checks;
- if existing tooling already satisfies this, evidence is recorded;
- if existing tooling does not satisfy this, Vite/plugin changes are required before merge.

Error coverage:

- inactive branch import leaking into active platform fails the test;
- plugin recognition must be tied to `asyncRouteComponent({ browser, reactNative })`, not raw TanStack routes or `moduleAPI.registerRoute`.

## TEST_CASE_10A — current route loads first and other routes background-load

**Goal:** lock the approved loading strategy.

Steps:

1. Register multiple async route components.
2. Start the app on one initial/current route.
3. Assert the current route loader is invoked before non-current route loaders.
4. Assert the current route can render or show its loading boundary before all background loaders finish.
5. Navigate to a route whose background loader is still pending.
6. Assert loading state resolves to component/fallback/error consistently.
7. Assert duplicate navigation/background calls do not invoke the same loader repeatedly.

Expected:

- current route first behavior is deterministic;
- background loading starts after current route load begins;
- loader results are cached/deduped.

Error coverage:

- background import failure is surfaced deterministically;
- current route import failure errors and does not fallback unless the component is absent by missing `reactNative` key.

## TEST_CASE_11A — RN WebView fallback is only for absent native component

**Goal:** prove RN fallback behavior is narrow and does not mask errors.

Steps:

1. Define a route with browser component but no `reactNative` platform key.
2. Render through `SpringboardReactNavigationHost` with a valid async WebView target resolver.
3. Assert resolver is called with reason `missing-native-component`.
4. Assert resolver receives route ID/path and decoded params/search.
5. Assert the returned remote target renders through the RN WebView host.
6. Repeat with a returned local target and assert it renders through the RN WebView host.
7. Repeat with a route whose selected `reactNative` loader throws.
8. Repeat with a route whose selected `reactNative` loader returns `undefined`.
9. Repeat with invalid search params.

Expected:

- missing RN branch can fallback to WebView;
- import throw, selected loader `undefined`, render throw, and search validation failure do not fallback.

Error coverage:

- missing resolver hard-errors when fallback is required;
- resolver throwing/rejecting hard-errors;
- malformed target hard-errors.

## TEST_CASE_12A — WebView target resolver contract replaces config target resolution

**Goal:** validate the app-owned target resolution extension point without adding `springboard_config`.

Steps:

1. Configure host with a sync resolver returning `{ kind: 'remote', url: 'https://example.test/songs/123?autoplay=true' }`.
2. Navigate to a WebView-backed route with path params and search params.
3. Assert resolver receives normalized route context.
4. Assert returned target maps to the WebView source used by RN.
5. Configure host with an async resolver returning `{ kind: 'local', uri: '...' }` or the final local target shape.
6. Assert resolver loading state is handled and returned local target maps to WebView source.
7. Configure resolver to return `null`/`undefined`.
8. Configure resolver to return an invalid target.
9. Configure resolver to throw or reject.

Expected:

- Springboard does not require or read `springboard_config` for this behavior;
- app code controls remote/local/multi-remote/user-provided policy through the resolver;
- minimal target union supports remote and local paths;
- invalid resolver outcomes fail clearly.

Error coverage:

- no route override/config default behavior is tested because that policy is out of scope;
- full local bundle asset mapping policy is not required in this routing branch.

## TEST_CASE_13A — mobile-e2e demonstrates one shared native/WebView registry

**Goal:** prove the route API works in an RN/Expo app with native and WebView-backed routes.

Steps:

1. Extend `apps/mobile-e2e` rather than creating a separate example app.
2. Define one shared descriptor registry.
3. Include root route.
4. Include static route.
5. Include dynamic param route.
6. Include search-param route.
7. Include at least one native RN route component.
8. Include at least one browser/WebView-backed route where RN component is absent.
9. Use `springboard/router` navigation/hooks.
10. Wire `linkingPrefixes` from Expo/app code.
11. Provide one remote WebView target through callback/env/app code.
12. Provide one local WebView target through callback/env/app code.
13. Run/exercise the WebView-backed route once with the remote target.
14. Run/exercise the WebView-backed route once with the local target.
15. Exercise programmatic navigation and dynamic/search param display.

Expected:

- native and WebView-backed routes coexist in one registry;
- demo does not use `moduleAPI.registerRoute` / `moduleAPI.ui.registerRoute`;
- demo does not require `springboard_config`;
- Expo/user config land owns scheme/linking, remote WebView base URL, and local WebView source decisions.

Error coverage:

- missing remote URL/local URI/env/app resolver input fails clearly if the demo requires it;
- browser-only missing component still errors on browser if no browser branch exists.

## TEST_CASE_14A — weekly port boundaries remain controlled

**Goal:** avoid accidentally broadening the implementation while reconciling weekly branch concepts.

Steps:

1. Verify implementation changes are made only in the current branch/worktree.
2. Inspect weekly branch files only as needed for manual port planning.
3. Confirm no new `moduleAPI.ui.registerRoute` usage is introduced.
4. Confirm TanStack-backed web adapter remains intact.
5. Confirm mobile-e2e changes are minimal and routing-focused.
6. Record any substituted/blocked checks on `springboard-hob`.

Expected:

- no direct edits to `vk/d1e2-springboard-week`;
- no broad layout/template rewrite;
- no config/templateization implementation;
- merge risks are documented if package layout conflicts remain.

## Required checks after implementation

Run at minimum:

- `npm run check-types --prefix packages/springboard/core`
- `npm run check-types --prefix packages/springboard/platforms/webapp`
- `npm run check-types --prefix packages/springboard/platforms/react-native`
- `npm run check-types --prefix packages/jamtools/core`
- `npm run check-types --prefix packages/jamtools/features`
- `pnpm --filter springboard exec vitest --run router/router.spec.tsx`
- `pnpm --filter @springboardjs/platforms-react-native exec vitest --run`
- focused tests added for `asyncRouteComponent` / platform selector behavior;
- focused tests added for Vite/plugin conditional-compilation behavior if not already covered by existing checks;
- focused tests added for RN WebView target resolver;
- focused/mobile-e2e check(s) added during implementation;
- `git diff --check`

If a broad check is blocked by existing unrelated package/layout issues, record:

- command;
- failure summary;
- why it is unrelated;
- substituted focused check, if any.

## Result JSON template

Populate after implementation only:

```json
{
  "TEST_CASE_8A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_9A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_9B": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_10A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_11A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_12A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_13A": { "status": "PENDING", "evidence": [] },
  "TEST_CASE_14A": { "status": "PENDING", "evidence": [] }
}
```

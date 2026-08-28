# Async route components, RN WebView fallback, and weekly-port plan

Status: **plan/test-plan only**. Do not implement product code from this note until it has been reviewed and the user explicitly approves implementation.

Bead: `springboard-hob` — **Plan React Navigation RN routing shim for Springboard modules**.

Follow-up bead: `springboard-ze4` — **Plan springboard_config schema and templateization separately**.

## 1. Current decision summary

This plan builds on the already-approved RN routing MVP:

- Springboard route descriptors are canonical.
- Raw TanStack routes are not the cross-platform authoring API.
- Web remains TanStack-backed.
- RN remains React Navigation-backed.
- `moduleAPI.registerRoute` / `moduleAPI.ui.registerRoute` remain removed entirely.
- `asyncDefineRoute` is excluded from MVP.
- Route metadata collection stays synchronous.
- Type inference continues to come from `defineRoute` / `defineRoutes`, path params, and `validateSearch`.
- Current branch/worktree remains the destination for now; do not edit `vk/d1e2-springboard-week` directly.
- Weekly-port work in this step is planning only.

Latest form decisions incorporated by this update:

- Plan/test-plan edits are approved; implementation is not.
- If review approves this docs-only update, the next step is implementation followed by the normal review/fix cycle.
- Async route components are allowed, but the async path must be explicit.
- Synchronous components remain supported for simple apps.
- The user rejected an explicit absent-component sentinel for now.
- `undefined` is allowed as the absent-component signal only under a narrowly defined platform-selection contract.
- Use the explicit map shape `asyncRouteComponent({ browser, reactNative })`.
- Do not add a `runOnSwitch` helper for MVP.
- Do not use a manual `runOn` loader as the primary MVP API.
- The Vite plugin must recognize `asyncRouteComponent` platform branches before merge if that is needed to prevent inactive platform imports from breaking or being bundled into the active platform.
- Loading strategy is **current route first + background-load the rest**.
- `springboard_config` schema/codegen/templateization is out of scope for this routing branch and is tracked by `springboard-ze4`.
- RN WebView fallback target selection uses an app-provided callback resolver.
- The WebView target resolver may be async.
- Minimal WebView target shape is a remote/local union.
- Browser fallback is out of scope: browser missing component is a hard error.
- `apps/mobile-e2e` should cover two WebView target runs: one remote and one local, both via callback/env/app code. The callback resolver is the extension point for broader local, multiple remote, and user-provided target decisions.

## 2. Problem to solve

The approved RN routing shim already establishes descriptor routing across web and React Native. The next work should make the routing API practical for isomorphic apps that share route registration while choosing platform-specific route components.

The app should be able to define one shared descriptor registry containing:

- native RN routes;
- browser routes rendered by TanStack on web;
- RN routes that fall back to a WebView when no native component is provided;
- static paths;
- dynamic path params;
- search params;
- navigation calls;
- React Navigation linking prefixes supplied by Expo/native app code.

This must be done without making route collection async, because async route metadata would make duplicate detection, typed route registration, TanStack route creation, React Navigation screen generation, and startup failure timing much riskier.

## 3. Recommended architecture

### 3.1 Keep route metadata synchronous

`defineRoute` and `defineRoutes` continue to synchronously describe route identity:

- path;
- search validator;
- route component declaration;
- optional RN WebView fallback metadata, if needed by the resolver contract;
- no async path discovery;
- no async route ID discovery;
- no async child route discovery;
- no async search validator registration.

The component itself may be sync or explicitly async, but the route descriptor remains synchronously collectable.

### 3.2 Explicit async component helper

Use an explicit helper named `asyncRouteComponent` unless review identifies a blocker.

The helper must not infer async behavior by checking whether a component value happens to be a `Promise` at runtime. The async path must be explicit in the route definition.

Conceptual shape:

```ts
import { asyncRouteComponent, defineRoute } from 'springboard/router'

export const songRoute = defineRoute({
  path: '/songs/$songId',
  validateSearch: (search) => ({
    autoplay: search.autoplay === 'true',
  }),
  component: asyncRouteComponent({
    browser: () => import('./SongPage.web').then((m) => m.SongPage),
    reactNative: () => import('./SongScreen.native').then((m) => m.SongScreen),
  }),
})
```

Synchronous components remain valid:

```ts
export const aboutRoute = defineRoute({
  path: '/about',
  component: AboutScreen,
})
```

### 3.3 Platform selector model

Use the explicit platform selector object directly in `asyncRouteComponent`.

Required MVP shape:

```ts
asyncRouteComponent({
  browser: () => import('./Dashboard.web').then((m) => m.DashboardPage),
  reactNative: () => import('./Dashboard.native').then((m) => m.DashboardScreen),
})
```

Do not add `runOnSwitch` for MVP. Do not make `springboard.runOn(...)` inside a single manual loader the primary public API for this branch.

The key design goal is that the platform selection expression is structurally visible to build tooling. The Vite plugin must be able to recognize this routing construct when conditional compilation is required, so inactive platform imports do not break the active platform build/checks or get bundled incorrectly.

### 3.4 Platform key naming

Do not use a public object key named `"react-native"` for the MVP helper unless review finds a strong reason. It is painful in TypeScript object literals and forces quoted property access.

Use `reactNative` for MVP.

Rejected alternatives:

- `rn` — too terse / less readable.
- `mobile` — ambiguous; could mean mobile web in future.
- `"react-native"` — accurate but awkward in TypeScript object syntax.

### 3.5 `undefined` safety contract

Because the user rejected an explicit sentinel for now, the plan must make `undefined` safe and narrow.

`undefined` is acceptable only when it means **no platform branch was selected**:

- a platform selector object has no key for the active platform;
- specifically for MVP, `asyncRouteComponent({ browser })` has no `reactNative` branch while running on RN.

That absence means:

- on RN, the route may use WebView fallback if the host has a valid resolver;
- on browser, the route errors because browser fallback is not part of MVP.

`undefined` is still a hard error when it can mask a bug:

- a selected loader resolves to `undefined`;
- a selected module import succeeds but the named export is `undefined`;
- a selected sync branch is explicitly `undefined`;
- a selected component factory returns a non-component;
- an import rejects/throws;
- the component render throws;
- search validation fails;
- route collection finds duplicate paths or derived ID collisions;
- navigation or hooks target a typed route that was not registered at runtime.

Implementation must preserve enough metadata to distinguish “missing active platform key” from “selected branch returned undefined.” If that cannot be done cleanly with the chosen helper API, the implementation must stop and return to review before coding further.

### 3.6 Conditional compilation / Vite plugin boundary

Vite/plugin recognition is part of feature completeness for this branch when it is needed for conditional compilation.

Merge requirement:

- inactive platform branch imports in `asyncRouteComponent({ browser, reactNative })` must not break active-platform builds/checks;
- inactive platform branch imports must not be bundled incorrectly into the active platform when the existing Springboard conditional-compilation tooling is responsible for removing inactive code;
- tests/checks must prove the active platform can build/typecheck with an inactive branch that would be invalid for that platform.

This section is intentionally about externally observable behavior, not a detailed plugin implementation. If implementation discovers no plugin change is needed because existing tooling already satisfies those checks, record that evidence. If inactive imports break or bundle incorrectly, update the Vite plugin in this branch before merge.

## 4. Async loading strategy

Use **current route first + background-load the rest**.

Runtime behavior:

1. Route descriptors are collected synchronously.
2. The adapter identifies the initial/current route.
3. The current route's selected component loader starts first.
4. Once the current route can render or show its fallback boundary, remaining route component loaders start in the background.
5. Navigation to a route whose component is still loading shows the adapter's loading state and then renders/falls back/errors according to the same rules.

Why this is the default:

- improves first-screen startup compared with loading every route before app render;
- still catches most import/component-availability problems early by warming remaining routes;
- avoids making route collection or duplicate detection async;
- gives RN and web adapters the same high-level lifecycle.

Risks to test:

- loader deduplication so the same route is not loaded repeatedly;
- stable React Navigation screen identity while component loading state changes;
- browser and RN error boundaries do not turn import/render failures into WebView fallback;
- background loader failures are reported deterministically enough for developers to debug.

## 5. Web adapter expectations

The browser adapter remains TanStack-backed.

Required behavior:

- Compile Springboard descriptors to TanStack routes.
- Use selected browser component from sync or async route component definitions.
- Preserve path/search inference exposed through `springboard/router`.
- Preserve web navigation semantics from the existing MVP.
- Throw for missing browser component; do not use RN WebView fallback on browser.

The web adapter may use TanStack lazy route APIs internally if that is the cleanest implementation, but raw TanStack route objects are not the cross-platform userland API.

## 6. RN adapter expectations

The RN adapter remains React Navigation-backed.

Required behavior:

- Continue one generated native-stack screen per Springboard route descriptor.
- Keep generated screen component identity stable.
- Continue passing configurable `linkingPrefixes` from owned host to React Navigation.
- Resolve route params/search exactly once at adapter boundary.
- Support dynamic deep-link-style params and search decoding.
- Select sync or async RN component branch when present.
- If no RN branch exists, call the app-provided WebView target resolver.
- Render WebView fallback only when the missing native component is the sole failure reason and the resolver returns a valid target.
- Throw for import failure, render failure, invalid resolver output, missing resolver when fallback is required, invalid search, duplicate route collection, and typed-but-not-runtime-registered navigation/hook targets.

## 7. RN WebView fallback via app-provided resolver

### 7.1 Fallback scope

Global RN fallback is allowed only for **absent native component**.

“Absent native component” means:

- the active platform is RN;
- route component definition is a platform selector;
- no RN key/branch is present for that route;
- no selected loader ran and returned `undefined`;
- no selected import failed;
- no selected component render failed.

This enables one shared registry where browser-only routes can still appear in the RN app through WebView fallback.

### 7.2 Resolver contract

Use an app-provided resolver instead of `springboard_config` route/default target resolution.

Conceptual host option:

```ts
<SpringboardReactNavigationHost
  linkingPrefixes={['springboard://']}
  resolveWebViewTarget={async (context) => {
    if (context.reason !== 'missing-native-component') return null

    return {
      kind: 'remote',
      url: new URL(context.routePath, process.env.EXPO_PUBLIC_WEBVIEW_BASE_URL).toString(),
    }
  }}
/>
```

The exact prop/type names can change during implementation review, but the resolver should receive enough information for app code to decide:

- route descriptor or route ID;
- path pattern;
- concrete path if available;
- decoded path params;
- normalized search;
- reason: currently only `missing-native-component`;
- platform: RN.

The resolver may be sync or async. Because async resolver results affect route rendering, RN fallback UI must distinguish:

- selected route component still loading;
- WebView target resolver still loading;
- resolver success;
- resolver failure or malformed target.

Minimal target union:

```ts
type SpringboardWebViewTarget =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; uri: string }
```

The exact local field name may change to match React Native WebView/source conventions or existing mobile-e2e assets, but the MVP must cover both a remote and a local target path without adding `springboard_config`. App code owns how local assets, one remote host, multiple remote hosts, or user-provided hosts are chosen.

### 7.3 Resolver failure policy

Hard errors:

- resolver is missing and fallback is required;
- resolver returns `null` / `undefined` when fallback is required;
- resolver returns a malformed target;
- resolver throws or rejects;
- target cannot be converted into a WebView source;
- async resolver rejects;
- WebView host component is not available in the RN platform package.

Not fallback-eligible:

- selected RN loader returns `undefined`;
- selected import returns missing export;
- selected import throws;
- component render throws;
- browser route lacks browser component;
- search validation fails.

## 8. `springboard_config` is out of scope

Do not add `springboard_config` schema, codegen, template generation, config file location, validation package, or local bundle asset mapping in this routing implementation.

Reason: the user decided this conflates routing work with broader templateization/config work.

The config/templateization planning is tracked by `springboard-ze4` — **Plan springboard_config schema and templateization separately**.

This routing branch may still use ordinary app-local Expo configuration, environment variables, or inline app code to provide:

- native scheme;
- React Navigation `linkingPrefixes`;
- WebView remote base URL for the mobile-e2e remote run;
- local WebView URI/source for the mobile-e2e local run;
- resolver function wiring.

Those are app concerns for this branch, not a Springboard config schema.

## 9. `apps/mobile-e2e` example plan

Extend `apps/mobile-e2e`; do not add a separate RN/Expo app for this branch.

The example should demonstrate one shared descriptor registry containing:

- root route;
- static route;
- dynamic param route;
- search-param route;
- native RN route component;
- browser component for web adapter;
- RN WebView-backed route where the RN platform branch is absent;
- navigation between routes using `springboard/router`;
- React Navigation `linkingPrefixes` wired from Expo/app code;
- remote WebView target produced by the app-provided resolver;
- local WebView target produced by the app-provided resolver.

Out of scope for this branch:

- checked-in `springboard_config`;
- template generation/codegen;
- multiple remote hosts beyond documenting that the resolver can implement them;
- broad mobile app layout/template rewrites.

The mobile-e2e runtime demo should have two WebView target paths/runs:

1. a remote target, such as an app-local env value;
2. a local target, using the smallest existing or easily-added local WebView source that does not require `springboard_config` or template generation.

The resolver contract should be flexible enough that future work can support one remote host, multiple remote hosts, local assets, or user-provided hosts without changing route descriptors.

## 10. Weekly branch integration plan

Do not merge, rebase, or edit `vk/d1e2-springboard-week` as part of this plan-only step.

Known integration complexity:

- weekly branch moved/consolidated Springboard package layout;
- weekly branch has RN/Expo/mobile-e2e work that may need manual porting;
- weekly branch previously introduced `moduleAPI.ui.registerRoute`, which conflicts with the approved removal of registerRoute APIs;
- this branch preserves the TanStack-backed web adapter;
- package JSON and lockfile conflicts are likely when the plan becomes implementation work.

Recommended implementation sequencing after review:

1. Keep current branch as the destination for the next implementation pass.
2. Manually inspect the weekly files needed for `apps/mobile-e2e`.
3. Port only the smallest mobile-e2e/example pieces needed to exercise descriptor routing.
4. Do not import weekly registerRoute API shape.
5. Keep TanStack-backed web routing intact.
6. Record any substituted checks or blocked weekly broad checks on `springboard-hob`.

## 11. TDD implementation phases

Implementation should not begin until this plan/test-plan update is reviewed and approved.

### Phase 0 — plan/test-plan review gate

- Update this plan and `test-plan-2`.
- Run `git diff --check`.
- Commit docs-only changes.
- Stop for review.

### Phase 1 — type contract and helper tests

Tests first:

- `asyncRouteComponent` accepts explicit async component definitions.
- plain sync components remain valid.
- route metadata collection remains synchronous.
- route params/search inference is unchanged.
- `asyncDefineRoute` does not exist.
- helper does not accept arbitrary Promise components by guessing at runtime.
- platform selector missing active key is the only allowed `undefined` absent-component signal.
- selected loader returning `undefined` is a hard error.
- inactive platform imports are conditionally compiled or otherwise proven not to break/bundle into the active platform.

Implementation after failing tests:

- add/adjust `springboard/router` public types;
- add platform selector representation;
- preserve descriptor type inference.

### Phase 2 — adapter loading behavior

Tests first:

- current route loader starts before background loaders;
- background loaders are deduped;
- current route can render while other route components are still loading;
- import failures surface as errors, not WebView fallback;
- browser missing component errors.

Implementation after failing tests:

- add route component resolution cache;
- integrate with web and RN adapters without changing route collection timing.

### Phase 3 — RN WebView resolver and fallback

Tests first:

- RN route with missing RN branch calls app resolver;
- resolver receives route ID/path/params/search/reason;
- valid remote target renders WebView fallback;
- valid local target renders WebView fallback;
- async resolver loading/success/error states are covered;
- missing resolver errors;
- invalid resolver output errors;
- resolver throw/reject errors;
- selected loader returning `undefined` errors and does not fallback;
- browser never uses WebView fallback.

Implementation after failing tests:

- add host resolver prop/type;
- add WebView fallback wrapper in RN route rendering path;
- keep existing deep-link params/search normalization behavior.

### Phase 4 — mobile-e2e example

Tests/checks first where practical:

- route registry compiles in shared code;
- native RN route renders;
- WebView-backed route resolves one remote target through app callback/env/app code;
- WebView-backed route resolves one local target through app callback/env/app code;
- root/static/dynamic/search routes exist;
- navigation uses `springboard/router`;
- linking prefix wiring remains app-owned.

Implementation after failing tests:

- extend `apps/mobile-e2e` minimally;
- avoid templateization and schema files;
- avoid broad UI/layout rewrites.

### Phase 5 — weekly-port validation notes

- Re-check likely merge conflicts against `vk/d1e2-springboard-week`.
- Document manual port notes if files moved.
- Do not edit weekly directly unless separately approved.

## 12. Acceptance criteria for implementation

The eventual implementation is not mergeable until all of these are true:

- route metadata collection remains sync;
- no `asyncDefineRoute`;
- explicit `asyncRouteComponent` path works;
- sync components still work;
- route params/search inference remains intact;
- current route first + background rest loading behavior is covered;
- `undefined` absent-component signal is limited to missing platform key/branch;
- selected loader/import returning `undefined` is a hard error;
- inactive platform branch imports do not break active platform build/checks and do not bundle incorrectly when conditional compilation applies;
- RN WebView fallback only handles absent native component;
- browser missing component is a hard error;
- sync and async app-provided WebView target resolver behavior is covered;
- remote and local WebView target union behavior is covered;
- mobile-e2e uses one shared descriptor registry with native + WebView-backed routes;
- mobile-e2e wires Expo/app-owned scheme/linking prefixes plus one remote and one local WebView target run;
- registerRoute APIs remain removed;
- raw TanStack route objects remain out of the cross-platform authoring API;
- TanStack web adapter remains intact;
- React Navigation RN adapter remains intact.

## 13. Required checks after implementation

At minimum rerun the approved routing checks plus new focused tests:

- `npm run check-types --prefix packages/springboard/core`
- `npm run check-types --prefix packages/springboard/platforms/webapp`
- `npm run check-types --prefix packages/springboard/platforms/react-native`
- `npm run check-types --prefix packages/jamtools/core`
- `npm run check-types --prefix packages/jamtools/features`
- `pnpm --filter springboard exec vitest --run router/router.spec.tsx`
- `pnpm --filter @springboardjs/platforms-react-native exec vitest --run`
- focused tests for `asyncRouteComponent` helper/type behavior;
- focused tests for RN WebView fallback resolver;
- focused/mobile-e2e checks added or updated during implementation;
- `git diff --check`

If a broad check is blocked by pre-existing weekly/package-layout issues, record the exact substituted command and failure set on `springboard-hob`.

## 14. Remaining review/form questions

These are the merge-critical decisions to confirm before implementation:

1. **Vite/plugin proof shape:** What exact build/check should prove inactive `asyncRouteComponent({ browser, reactNative })` imports do not break or bundle into the active platform?
   - Recommended default: add focused fixtures/tests in the existing plugin/build test area, plus existing package typechecks.
2. **Local WebView target field:** Should the local target be `{ kind: 'local'; uri: string }` or another shape matching existing mobile-e2e/WebView host conventions?
   - Recommended default: use the smallest shape that maps directly to the existing WebView source prop.
3. **Async resolver loading UI:** Should RN WebView resolver loading use the same loading boundary as async route component loading?
   - Recommended default: yes, share the adapter loading/error boundary where possible.
4. **Config scope:** Confirm all `springboard_config` schema/template/codegen work is deferred to `springboard-ze4`.
   - Recommended default: yes.

## 15. Review guidance

Review should evaluate whether this plan is narrow enough to implement safely:

- no product/code changes in the plan-only commit;
- config/templateization removed from routing scope;
- `undefined` absent-component behavior is constrained enough not to mask common bugs;
- WebView fallback resolver replaces route/default config target policy;
- mobile-e2e scope is sufficient to prove routing without becoming a template project;
- Vite/plugin conditional-compilation behavior is treated as a merge requirement when inactive platform imports would otherwise break active-platform builds/checks.

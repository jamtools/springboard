# TanStack Router to React Native Routing Implementation Plan

Bead: `springboard-hob` — Plan React Navigation RN routing shim for Springboard modules

## Status

This is a review plan, not an implementation patch.

The current direction is to make Springboard own the cross-platform route model and type system, while treating TanStack Router as the web runtime adapter and React Navigation as the React Native runtime adapter.

## Decisions already made

- Use Springboard-owned route descriptors as the canonical route model.
- Add a `defineRoute` / `defineRoutes` builder API.
- Keep the route-definition API intentionally compatible with TanStack `createRoute` concepts where practical.
- Require TanStack-equivalent type safety for the MVP feature set.
- Use declaration merging for app-wide route registry typing.
- Expose platform-neutral hooks from `springboard/router`.
- Use `validateSearch` to unlock precise typed search/query params.
- Let Springboard own typed path interpolation, route matching, query validation, and route hooks.
- Treat React Navigation as the RN stack/screen transport.
- Generate one React Navigation native-stack screen per Springboard route descriptor.
- Expose a TanStack-like navigation API: `navigate({to, params, search})`.
- Rewrite modules to new Springboard route patterns instead of supporting raw TanStack imports indefinitely.
- Remove `moduleAPI.registerRoute` entirely from the new routing API for this branch.
- Use `useSearch` only for query/search params in MVP; do not add a `useQuery` alias yet.
- Require globally unique route `path` values in MVP.
- Derive stable internal route/screen IDs from route paths.
- Throw during route collection if duplicate paths or derived IDs are detected.
- Let Springboard own `NavigationContainer` in the default MVP host, while factoring the generated stack as an embeddable child component for future app-provided containers.
- Treat the current first implementation slice as foundational only; add a separate feature-complete MVP acceptance slice before implementation is considered done.

## MVP scope

The MVP should support:

- Root route: `/`
- Static paths: `/settings`
- Dynamic path params: `/songs/$songId`
- Typed search/query params via `validateSearch`
- Programmatic navigation via `navigate({to, params, search})`
- Route hooks:
  - `useNavigate`
  - `useParams`
  - `useSearch`
  - `getRouteApi`
- Web runtime adapter using TanStack Router
- React Native runtime adapter using React Navigation native stack

The MVP should defer:

- Nested layouts / outlets
- Splat routes
- Route loaders
- Route guards / before-load semantics
- Route masks
- Full TanStack route parity
- Browser-specific link/preload/scroll behavior
- `useQuery` alias for `useSearch`

## Proposed architecture

### 1. Canonical route descriptors

Create Springboard route descriptors in core. These are the single source of truth for route path, component, params, search validation, and platform options.

Conceptual shape:

```ts
type SpringboardRouteDescriptor = {
    path: string;
    component: React.ComponentType;
    validateSearch?: (search: Record<string, unknown>) => unknown;
    params?: {
        parse?: (params: Record<string, string>) => unknown;
        stringify?: (params: unknown) => Record<string, string>;
    };
    options?: {
        title?: string;
        hideApplicationShell?: boolean;
        presentation?: 'card' | 'modal';
    };
};
```

The final implementation should avoid `any` in public types. The conceptual type above is intentionally simplified for review.

MVP route identity policy:

- `path` is the public route identity.
- Every collected route path must be globally unique across all registered modules.
- Internal React Navigation screen names are derived from normalized route paths.
- The derived ID function must be stable and deterministic across web/RN/test runs.
- Route collection must throw with a clear module/path error when duplicate paths or derived IDs are found.
- Explicit user-provided IDs are deferred until there is a concrete need that cannot be solved with unique paths.

### 2. Route definition builder

Add a Springboard-owned route builder:

```ts
const route = defineRoute({
    path: '/songs/$songId',
    validateSearch: (search) => ({
        tab: search.tab === 'lyrics' ? 'lyrics' : 'overview',
    }),
    component: SongScreen,
});
```

For multiple routes:

```ts
const routes = defineRoutes([
    defineRoute({path: '/', component: HomeScreen}),
    defineRoute({path: '/songs/$songId', component: SongScreen}),
]);
```

This API should intentionally mirror TanStack concepts:

- `path`
- `component`
- `validateSearch`
- `params.parse`
- `params.stringify`

But it should not require userland to import `@tanstack/react-router`.

### 3. Platform-neutral router exports

Add a public module, `springboard/router`, that exports:

```ts
defineRoute
defineRoutes
getRouteApi
useNavigate
useParams
useSearch
```

The web implementation delegates to TanStack runtime state.

The RN implementation reads from Springboard route context and calls React Navigation under the hood.

Userland modules should import from `springboard/router` for cross-platform routing.

MVP packaging requirement:

- Add a root-level `router` entrypoint in the Springboard core package, matching existing root-folder import style such as `springboard/engine/...`.
- Include that entrypoint in the package's published `files`.
- Update workspace TypeScript path aliases so local packages can import `springboard/router`.
- Add a consumer-package import test or typecheck fixture that proves `springboard/router` resolves before publish.
- Do not make a broader package `exports` redesign part of the MVP unless current packaging forces it.

### 4. Runtime adapters

Springboard core owns route typing, matching, path interpolation, and validated query parsing.

Runtime adapters are responsible for rendering:

- Web adapter: descriptors to TanStack route tree.
- RN adapter: descriptors to React Navigation native-stack screens.

React Navigation should not be treated as the source of route truth. It is the native stack/screen transport.

## Type-safety plan

The type-safety target is: mimic TanStack's benefits for the supported MVP feature set.

### Path params

The route builder should infer path params from `$param` path segments.

Examples:

```ts
defineRoute({path: '/songs/$songId', component: SongScreen});
```

Should infer:

```ts
type Params = {
    songId: string;
};
```

Required compile-time behavior:

- Missing `songId` in `navigate({to: '/songs/$songId', params: ...})` fails.
- Extra params fail where practical.
- `useParams({from: '/songs/$songId'})` returns `{songId: string}`.
- `getRouteApi('/songs/$songId').useParams()` returns `{songId: string}`.

### Search/query params

Precise search/query typing should require `validateSearch`.

Example:

```ts
const songRoute = defineRoute({
    path: '/songs/$songId',
    validateSearch: (search) => ({
        tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
    }),
    component: SongScreen,
});
```

Should infer:

```ts
type Search = {
    tab: 'lyrics' | 'overview';
};
```

Required compile-time behavior:

- `useSearch({from: '/songs/$songId'})` returns the validated search type.
- `navigate({to: '/songs/$songId', search: ...})` checks against the validated search type.
- Routes without `validateSearch` should not pretend to have precise query types.
- `useQuery` is intentionally not part of MVP; add it later only if there is clear product need for an alias.

### Global route registry

Use declaration merging, similar in spirit to TanStack's global router registration.

Required public type shape for MVP:

```ts
const routes = defineRoutes([
    defineRoute({
        path: '/',
        component: HomeScreen,
    }),
    defineRoute({
        path: '/songs/$songId',
        validateSearch: (search) => ({
            tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
        }),
        component: SongScreen,
    }),
]);

declare module 'springboard/router' {
    interface Register {
        routes: typeof routes;
    }
}
```

The MVP API should use `Register.routes`. If implementation discovers a better name, that rename must be made in the plan before code proceeds; implementation should not leave this underspecified.

The registry must support app-wide inference for:

- Valid `to` values.
- Param requirements per path.
- Search requirements per path.
- `getRouteApi(path)`.
- `useParams({from: path})`.
- `useSearch({from: path})`.
- Runtime validation when a route exists in types but is not registered by loaded modules.

### Typed navigation API

Expose TanStack-like object navigation:

```ts
const navigate = useNavigate();

navigate({
    to: '/songs/$songId',
    params: {songId: 'abc'},
    search: {tab: 'lyrics'},
});
```

This API should compile on both web and RN.

On web, it should delegate to TanStack navigation.

On RN, it should:

1. Resolve the route descriptor by `to`.
2. Validate/interpolate path params.
3. Validate/normalize search via `validateSearch`, if present.
4. Find the generated React Navigation screen for that descriptor.
5. Navigate to that screen with serializable route params.

### Type-level acceptance tests

Add compile-time tests that mimic TanStack behavior.

Recommended tests:

```ts
// OK
navigate({
    to: '/songs/$songId',
    params: {songId: 'abc'},
    search: {tab: 'lyrics'},
});

// @ts-expect-error missing path param
navigate({
    to: '/songs/$songId',
    params: {},
});

// @ts-expect-error wrong search value
navigate({
    to: '/songs/$songId',
    params: {songId: 'abc'},
    search: {tab: 'invalid'},
});

const params = useParams({from: '/songs/$songId'});
params.songId satisfies string;

const search = useSearch({from: '/songs/$songId'});
search.tab satisfies 'lyrics' | 'overview';

const songApi = getRouteApi('/songs/$songId');
songApi.useParams().songId satisfies string;
songApi.useSearch().tab satisfies 'lyrics' | 'overview';

// @ts-expect-error unknown route path
getRouteApi('/missing');

// @ts-expect-error search is not precise without validateSearch
useSearch({from: '/unvalidated'}).tab satisfies 'lyrics';
```

The initial implementation should add these compile-time tests before adding runtime adapters. Failing or skipped type tests mean the plan is not ready to drive runtime code.

## React Native adapter plan

### Dependencies

The RN platform package should add React Navigation as peer dependencies, not hard runtime dependencies of Springboard core:

- `@react-navigation/native`
- `@react-navigation/native-stack`

The Expo/native app should remain responsible for native setup dependencies required by React Navigation.

### Generated native-stack screens

Create an RN route host component that:

1. Reads initialized modules from the Springboard engine.
2. Collects route descriptors from all modules.
3. Validates duplicate paths and derives stable internal route IDs.
4. Creates one native-stack screen per descriptor.
5. Wraps each screen in Springboard route context.
6. Renders the matched route component.

Conceptual shape:

```tsx
const Stack = createNativeStackNavigator();

export function SpringboardNavigationStack() {
    const engine = useSpringboardEngine();
    const modules = engine.moduleRegistry.useModules();
    const routes = useMemo(() => collectRouteDescriptors(modules), [modules]);

    return (
        <SpringboardRouterProvider routes={routes}>
            <Stack.Navigator>
                {routes.map(route => (
                    <Stack.Screen
                        key={route.internalId}
                        name={route.internalId}
                        component={StableSpringboardScreen}
                        initialParams={{__springboardRouteId: route.internalId}}
                    />
                ))}
            </Stack.Navigator>
        </SpringboardRouterProvider>
    );
}

export function SpringboardReactNavigationHost() {
    return (
        <NavigationContainer>
            <SpringboardNavigationStack />
        </NavigationContainer>
    );
}
```

MVP ownership rule:

- `SpringboardReactNavigationHost` owns `NavigationContainer` by default.
- `SpringboardNavigationStack` must be exported or otherwise factored as the embeddable child component for apps that will later provide their own container.
- The plan should not implement the embedded variant's full API yet, but the component boundary must avoid forcing a rewrite.

Screen stability rule:

- Do not call `createSpringboardScreen(route)` inline during render if it returns a new component identity.
- Prefer a generic stable `StableSpringboardScreen` that resolves the descriptor by internal route ID from context.
- If implementation instead generates per-route components, those components must be memoized by a stable route signature and covered by a test or review checklist item to prevent remount/state-loss regressions.

### Screen params

React Navigation params should stay serializable.

Use an internal param shape like:

```ts
type SpringboardRNRouteParams = {
    __springboardRouteId: string;
    __springboardPathParams?: Record<string, string>;
    __springboardSearch?: Record<string, unknown>;
};
```

The screen wrapper should read those params, validate them against the descriptor, and expose normalized route state through Springboard route context.

### Route context

RN hooks should read from route context:

```ts
type SpringboardRouteContextValue = {
    routeId: string;
    path: string;
    pathParams: Record<string, string>;
    search: Record<string, unknown>;
    navigate: SpringboardNavigate;
};
```

The public hooks must return typed values, even if the internal context uses broader runtime types.

### Deep links

The MVP can use React Navigation linking configuration for basic deep links.

Convert Springboard path syntax to React Navigation path syntax:

```ts
'/songs/$songId' -> 'songs/:songId'
```

Deep-link handling should eventually feed into the same Springboard-owned parser and validator used by programmatic navigation.

### Manual route matching

Implement a small Springboard route matcher for the MVP.

Supported path syntax:

- `/`
- static segments
- `$param` dynamic segments

Ranking rules:

1. More static segments win.
2. Fewer dynamic segments win.
3. Longer exact paths win.
4. Registration order is a last-resort tie breaker.

Route collection should reject duplicate paths before matching. Ranking is only for distinct route patterns that can both match the same concrete URL, such as `/songs/new` and `/songs/$songId`.

The matcher should return:

```ts
type RouteMatch = {
    route: SpringboardRouteDescriptor;
    pathParams: Record<string, string>;
};
```

## Web adapter plan

The existing web path creates TanStack routes directly from module-provided `AnyRoute[]`.

The target web path should instead be:

1. Modules define Springboard route descriptors.
2. Web adapter compiles descriptors to TanStack `createRoute` calls.
3. `FrontendRoutes` builds the TanStack route tree from compiled TanStack routes.
4. `RouterProvider` remains the web runtime renderer.

This preserves TanStack as the browser runtime without making TanStack the framework-level route model.

### Web adapter responsibilities

The web adapter should:

- Convert `path` to TanStack route path.
- Pass through `component`.
- Pass through `validateSearch`.
- Pass through params parse/stringify where supported.
- Use the existing `rootRoute`.
- Preserve current web behavior for supported MVP route features.

### Avoid global router recreation churn

The current `FrontendRoutes` creates a router during render:

```tsx
const router = createAppRouter(typedRoutes);
return <RouterProvider router={router} />;
```

As part of implementation, review whether this should be memoized by route descriptor identity to avoid replacing the router unnecessarily as modules refresh.

This is not required for the routing model design, but it is a likely correctness/stability improvement.

## Module migration plan

Current patterns include:

- `moduleAPI.registerRoute(...)`
- Raw TanStack `createRoute(...)` arrays.
- Direct imports from `@tanstack/react-router`.

Target patterns:

- Cross-platform modules use `springboard/router`.
- Modules define routes only through `defineRoute` / `defineRoutes`.
- Direct `@tanstack/react-router` imports are removed from cross-platform modules.
- `moduleAPI.registerRoute` is removed from the public API for this branch; it should not remain as non-deprecated, transitional, deprecated, or descriptor-backed convenience.

### Removed `moduleAPI.registerRoute`

`moduleAPI.registerRoute` should be deleted instead of migrated to descriptors.

Removed call shape:

```ts
moduleAPI.registerRoute('/songs/$songId', SongScreen);
```

Target behavior:

- Existing call sites are rewritten to `defineRoute` / `defineRoutes`.
- New routing examples import route helpers from `springboard/router`.
- Attempted use of `moduleAPI.registerRoute` fails clearly at typecheck; if any runtime compatibility path is unavoidable during migration, it should throw an actionable error rather than registering a route.
- No descriptor-backed wrapper is added for this branch.

### Raw TanStack routes

Raw TanStack routes should not be an RN compatibility target.

Migration policy:

- Rewrite modules to `springboard/router`.
- Keep any direct TanStack usage explicitly web-only, if such a web-only escape hatch is needed later.
- Do not build a long-term `@tanstack/react-router` alias or monkey patch for RN.

## Implementation phases

### Phase 1: Core route descriptor types

Deliverables:

- Add `springboard/router` public entrypoint.
- Add `defineRoute` and `defineRoutes`.
- Add descriptor types.
- Add type-level path param inference.
- Add compile-time type tests.

Validation:

- Type tests prove path params are inferred from `$param`.
- Type tests prove `validateSearch` return types are used for search/query.
- No runtime adapter changes yet.

### Phase 2: Core runtime route utilities

Deliverables:

- Add route collection from modules.
- Add duplicate route path detection and deterministic path-derived internal IDs.
- Add route path compiler.
- Add route matcher.
- Add path interpolation.
- Add search validation helper.

Validation:

- Unit tests for static and dynamic path matching.
- Unit tests for duplicate path errors with module/path details.
- Unit tests proving internal IDs are stable for a given path.
- Unit tests for interpolation.
- Unit tests for route ranking.
- Unit tests for `validateSearch` normalization.

### Phase 3: Web adapter migration

Deliverables:

- Compile Springboard descriptors to TanStack routes.
- Update `FrontendRoutes` to consume descriptors.
- Keep current web examples working.
- Rewrite `test_tanstack_module.tsx` or add a new cross-platform route test module using `springboard/router`.

Validation:

- Existing web route tests still pass.
- Type tests still pass.
- Browser TanStack navigation still works for supported MVP features.

### Phase 4: RN adapter

Deliverables:

- Add React Navigation peer dependencies to RN package.
- Add Springboard-owned `SpringboardReactNavigationHost`.
- Factor an embeddable `SpringboardNavigationStack` child component.
- Generate native-stack screens from descriptors using stable component identity.
- Add RN implementations of `useNavigate`, `useParams`, `useSearch`, and `getRouteApi`.
- Add linking config conversion for basic deep links.

Validation:

- Unit tests with mocked React Navigation where practical.
- RN route context tests.
- RN navigation param serialization tests.
- Tests or review checklist coverage that screen component identities do not churn during host re-render.

### Phase 5: Module migration

Deliverables:

- Rewrite cross-platform modules away from direct `@tanstack/react-router` imports.
- Prefer `springboard/router` in examples and docs.
- Remove `moduleAPI.registerRoute` from `ModuleAPI`.
- Rewrite existing `moduleAPI.registerRoute` call sites to module return values that expose `routes: defineRoutes([...])`, or to direct `defineRoute` / `defineRoutes` where the surrounding module shape already supports route returns.
- Ensure no new descriptor-backed wrapper remains.

Validation:

- `grep` shows no direct TanStack imports in cross-platform modules.
- `grep` shows no active `moduleAPI.registerRoute` call sites.
- Type tests or package typecheck prove `ModuleAPI` no longer exposes `registerRoute`.
- Web-only direct TanStack imports, if any, are isolated and documented.

### Phase 6: Documentation

Deliverables:

- Document `defineRoute` / `defineRoutes`.
- Document `springboard/router` hooks.
- Document RN limitations for MVP.
- Document migration from TanStack imports.

Validation:

- Create one small end-to-end example with:
  - `/`
  - `/songs/$songId`
  - validated query params
  - typed navigation

## Test strategy

Follow TDD wherever possible.

### Type tests

Use TypeScript compile-time tests with `@ts-expect-error`.

Test categories:

- Valid `navigate({to, params, search})` calls compile.
- Missing path params fail.
- Extra path params fail where TypeScript can reasonably enforce exactness.
- Wrong search values fail.
- `useParams({from})` returns exact param keys.
- `useSearch({from})` returns validated search type.
- `getRouteApi(path).useParams()` and `.useSearch()` infer correctly.
- Unknown paths fail for `navigate`, `getRouteApi`, `useParams({from})`, and `useSearch({from})`.
- `useQuery` is absent from MVP public type tests.

### Runtime unit tests

Test categories:

- Descriptor creation.
- Module route collection.
- Duplicate route path detection.
- Path-derived internal route ID stability.
- Path matching.
- Route ranking.
- Path interpolation.
- Search validation.
- RN context decoding.
- Web descriptor-to-TanStack conversion.

### Integration tests

Test categories:

- Web app can navigate between descriptor-backed routes.
- RN route host can render a descriptor-backed screen.
- RN navigation receives serializable params.
- Deep link parsing works for static and `$param` paths.

## Risks and mitigations

### Risk: Recreating TanStack's type system poorly

Mitigation:

- Keep MVP type scope narrow.
- Explicitly mimic TanStack only for supported features.
- Add compile-time tests before runtime implementation.
- Prefer route builder types that are easy to reason about over clever opaque types.

### Risk: React Navigation types conflict with Springboard route types

Mitigation:

- Treat React Navigation ParamList as an internal adapter detail.
- Keep Springboard descriptors as the source of type truth.
- Pass serializable internal params to React Navigation.
- Expose typed Springboard hooks to userland instead of React Navigation hooks.

### Risk: Module registry routes are runtime-discovered

Declaration merging provides compile-time app-wide types, but module loading is runtime.

Mitigation:

- Keep route descriptors as normal runtime values.
- Use declaration merging for authoring-time inference.
- Add runtime validation for unknown route IDs/paths during navigation and hook resolution.
- Fail loudly when `navigate`, `useParams`, `useSearch`, or `getRouteApi` references a compile-time-typed route that is missing from the loaded runtime descriptor registry.
- Do not try to detect typed-but-not-runtime-registered routes during route collection; TypeScript declaration-merged routes are erased at runtime.

### Risk: Existing route API overloads become confusing

Mitigation:

- Document one recommended cross-platform path:
  - `defineRoute` / `defineRoutes`
  - `springboard/router` hooks
- Remove `moduleAPI.registerRoute` instead of retaining multiple route registration APIs.
- Avoid supporting raw TanStack route objects in RN.

### Risk: Search params are not actually safe

Mitigation:

- Require `validateSearch` for precise types.
- Treat unvalidated search as unknown or loose record.
- Run validation in both web and RN adapters.

### Risk: `springboard/router` works locally but fails for consumers

Mitigation:

- Treat package exposure as part of Phase 1, not as cleanup.
- Add the root-level router entrypoint to package `files`.
- Update TS paths and add a consumer import/typecheck validation.

### Risk: Duplicate route paths collide across modules

Mitigation:

- Require globally unique paths in MVP.
- Derive internal screen IDs from paths.
- Throw during route collection with enough module/path context to fix the collision.

### Risk: RN screens remount because generated component identities change

Mitigation:

- Prefer a stable generic screen wrapper that resolves descriptors by internal route ID.
- Memoize routes by stable route signatures.
- Cover component identity stability in tests or the implementation review checklist.

### Risk: `NavigationContainer` ownership blocks real app integration

Mitigation:

- Ship a Springboard-owned host for MVP.
- Factor the generated stack as an embeddable child component.
- Defer the full app-provided-container API until there is an integration target, but avoid an MVP design that forces a rewrite.

## Resolved review decisions

These decisions came from the `rn_plan_review_resolution` form for `springboard-hob` — Plan React Navigation RN routing shim for Springboard modules:

1. Proceed with a plan-only edit pass first; do not implement code until the revised plan is reviewed.
2. Keep a staged delivery model: foundational slice first, then a feature-complete MVP acceptance slice.
3. Use globally unique paths with derived stable internal IDs; do not require explicit IDs in MVP.
4. Default to a Springboard-owned `NavigationContainer`, but keep the route stack embeddable.
5. Expose `useSearch` only in MVP; do not add `useQuery` yet.
6. Require exact type-test examples before implementation.

## Resolved superseding decisions

These supersede earlier discussion answers:

1. Remove `moduleAPI.registerRoute` entirely for this branch.
2. Duplicate route paths and derived ID collisions fail during route collection.
3. Typed-but-not-runtime-registered routes fail during navigation/hook resolution (`navigate`, `useParams`, `useSearch`, `getRouteApi`) because TypeScript declaration-merged routes are erased at runtime.
4. Descriptor screen options such as titles and modal presentation remain reserved/deferred unless required by tests/examples. A low-risk optional RN argument can be documented later, but it is not needed for MVP implementation.

## Recommended first foundational implementation slice

The safest first mergeable slice is foundational only:

1. Add descriptor and builder types.
2. Add the concrete `springboard/router` public entrypoint and packaging/consumer import validation.
3. Add declaration-merging `Register.routes` support.
4. Add type tests for path params, `validateSearch`, `navigate`, `useParams`, `useSearch`, and `getRouteApi`.
5. Add runtime route matcher/interpolator unit tests, including duplicate path detection and stable derived IDs.
6. Add implementation for matcher/interpolator/route collection.
7. Do not change web or RN runtime behavior yet.

This gives high confidence in the hardest part, type safety, before changing rendering behavior.

This slice must not be described as completing RN routing. It is mergeable only as a tested foundation.

## Feature-complete MVP acceptance slice

The feature-complete MVP is not done until a later slice proves the architecture end-to-end:

1. Web adapter compiles descriptor-backed routes to TanStack routes and preserves existing web behavior.
2. RN host renders descriptor-backed routes through React Navigation native stack.
3. `SpringboardReactNavigationHost` owns `NavigationContainer` by default.
4. `SpringboardNavigationStack` is factored as the embeddable stack child.
5. RN screens use stable component identity.
6. `navigate({to, params, search})` works on RN for one root route, one static route, one dynamic route, and one validated-search route.
7. `useParams`, `useSearch`, and `getRouteApi` return typed values for the active route.
8. Runtime route collection throws on duplicate paths and derived ID collisions; runtime navigation/hook resolution throws when `navigate`, `useParams`, `useSearch`, or `getRouteApi` references a compile-time-typed route that is missing from the loaded runtime descriptor registry.
9. Tests cover web descriptor compilation, RN route context, serializable React Navigation params, and static/dynamic/query deep-link parsing.
10. Cross-platform example modules import from `springboard/router`, not directly from `@tanstack/react-router`.

## Review checklist

- [ ] Type-safety target is acceptable.
- [ ] MVP scope is narrow enough.
- [ ] Web adapter strategy is acceptable.
- [ ] RN adapter strategy is acceptable.
- [ ] Migration policy is acceptable.
- [ ] Test strategy is sufficient.
- [ ] Packaging for `springboard/router` is explicitly covered.
- [ ] Route identity policy is unique paths with derived stable IDs.
- [ ] RN screen component identity is stable across host re-renders.
- [ ] `NavigationContainer` ownership and embeddable stack boundary are explicit.
- [ ] Foundational slice is not confused with feature-complete RN routing.
- [ ] Remaining questions are resolved or explicitly deferred.

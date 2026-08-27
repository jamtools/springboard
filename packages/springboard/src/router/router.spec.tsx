import React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it} from 'vitest';

import {
    SpringboardRouterProvider,
    collectRouteDescriptors,
    defineRoute,
    defineRoutes,
    interpolatePath,
    loadSpringboardRouteComponent,
    matchRoute,
    normalizeSearch,
    preloadSpringboardRouteComponents,
    resolveRegisteredRoute,
    useParams,
    useSpringboardRouteProps,
    useSearch,
} from './index';
import type {SpringboardRouteComponentLoaders, SpringboardRouteProps} from './index';

const Screen = () => React.createElement('div');
const platformComponent = <TPath extends string, TSearch = Record<string, unknown>>(
    component: React.ComponentType<SpringboardRouteProps<TPath, TSearch>>,
): SpringboardRouteComponentLoaders<TPath, TSearch> => ({
    browser: async (route) => route.component(component),
    reactNative: async (route) => route.component(component),
});

describe('springboard/router runtime utilities', () => {
    it('defines routes and derives stable internal IDs from normalized paths', () => {
        const routes = defineRoutes([
            defineRoute({path: '/', component: platformComponent(Screen)}),
            defineRoute({path: '/songs/$songId', component: platformComponent(Screen)}),
        ]);

        const descriptors = collectRouteDescriptors([
            {moduleId: 'Music', routes},
        ]);

        expect(descriptors.map(route => route.internalId)).toEqual([
            'springboard_route_root',
            'springboard_route_songs_songId',
        ]);
        expect(collectRouteDescriptors([{moduleId: 'Music', routes}])).toEqual(descriptors);
    });

    it('throws during collection for duplicate paths with module context', () => {
        const first = defineRoute({path: '/settings', component: platformComponent(Screen)});
        const second = defineRoute({path: '/settings/', component: platformComponent(Screen)});

        expect(() => collectRouteDescriptors([
            {moduleId: 'SettingsA', routes: [first]},
            {moduleId: 'SettingsB', routes: [second]},
        ])).toThrow(/duplicate route path "\/settings".*SettingsA.*SettingsB/i);
    });

    it('throws during collection for derived internal ID collisions', () => {
        const first = defineRoute({path: '/songs-new', component: platformComponent(Screen)});
        const second = defineRoute({path: '/songs_new', component: platformComponent(Screen)});

        expect(() => collectRouteDescriptors([
            {moduleId: 'SongsA', routes: [first]},
            {moduleId: 'SongsB', routes: [second]},
        ])).toThrow(/derived route id collision "springboard_route_songs_new".*\/songs-new.*\/songs_new/i);
    });

    it('matches static routes before dynamic routes', () => {
        const routes = collectRouteDescriptors([
            {
                moduleId: 'Music',
                routes: defineRoutes([
                    defineRoute({path: '/songs/$songId', component: platformComponent(Screen)}),
                    defineRoute({path: '/songs/new', component: platformComponent(Screen)}),
                ]),
            },
        ]);

        expect(matchRoute(routes, '/songs/new')?.route.path).toBe('/songs/new');
        expect(matchRoute(routes, '/songs/123')?.pathParams).toEqual({songId: '123'});
    });

    it('interpolates dynamic params and rejects missing params before navigation', () => {
        expect(interpolatePath('/songs/$songId', {songId: 'abc'})).toBe('/songs/abc');
        expect(() => interpolatePath('/songs/$songId', {})).toThrow(/missing path param "songId"/i);
    });

    it('normalizes search with validateSearch and rejects missing runtime descriptors during resolution', () => {
        const route = defineRoute({
            path: '/songs/$songId',
            component: platformComponent(Screen),
            validateSearch: (search) => ({
                tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
            }),
        });
        const routes = collectRouteDescriptors([{moduleId: 'Music', routes: [route]}]);

        expect(normalizeSearch(route, {tab: 'lyrics'})).toEqual({tab: 'lyrics'});
        expect(normalizeSearch(route, {tab: 'other'})).toEqual({tab: 'overview'});
        expect(resolveRegisteredRoute(routes, '/songs/$songId').path).toBe('/songs/$songId');
        expect(() => resolveRegisteredRoute(routes, '/typed-but-missing')).toThrow(
            /route "\/typed-but-missing" is typed but is not registered at runtime/i,
        );
    });

    it('does not re-run search validation after an adapter stores normalized search in context', () => {
        const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean};
        const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        const route = defineRoute({
            path: '/discounts',
            component: platformComponent(Screen),
            validateSearch: (search) => ({
                hasDiscount: search.hasDiscount === 'true',
            }),
        });
        const routes = collectRouteDescriptors([{moduleId: 'Deals', routes: [route]}]);
        const container = document.createElement('div');
        const root = createRoot(container);
        let observedSearch: {hasDiscount: boolean} | undefined;

        const Probe = () => {
            observedSearch = useSearch({from: '/discounts'}) as {hasDiscount: boolean};
            return null;
        };

        act(() => {
            root.render(
                <SpringboardRouterProvider routes={routes} search={{hasDiscount: true}}>
                    <Probe />
                </SpringboardRouterProvider>,
            );
        });

        expect(observedSearch).toEqual({hasDiscount: true});

        act(() => {
            root.unmount();
        });
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    });

    it('uses stable empty params and search objects when route context has none', () => {
        const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean};
        const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        const route = defineRoute({path: '/', component: platformComponent(Screen)});
        const routes = collectRouteDescriptors([{moduleId: 'Root', routes: [route]}]);
        const container = document.createElement('div');
        const root = createRoot(container);
        const observedParams: unknown[] = [];
        const observedSearch: unknown[] = [];
        const observedRouteProps: unknown[] = [];
        const observedRoutePropParams: unknown[] = [];
        const observedRoutePropSearch: unknown[] = [];

        const Probe = () => {
            const params = useParams({from: '/'});
            const search = useSearch({from: '/'});
            const routeProps = useSpringboardRouteProps();
            observedParams.push(params);
            observedSearch.push(search);
            observedRouteProps.push(routeProps);
            observedRoutePropParams.push(routeProps.params);
            observedRoutePropSearch.push(routeProps.search);
            return null;
        };

        act(() => {
            root.render(
                <SpringboardRouterProvider routes={routes}>
                    <Probe />
                </SpringboardRouterProvider>,
            );
        });

        act(() => {
            root.render(
                <SpringboardRouterProvider routes={routes}>
                    <Probe />
                </SpringboardRouterProvider>,
            );
        });

        expect(observedParams).toHaveLength(2);
        expect(observedSearch).toHaveLength(2);
        expect(observedParams[1]).toBe(observedParams[0]);
        expect(observedSearch[1]).toBe(observedSearch[0]);
        expect(observedRouteProps[1]).toBe(observedRouteProps[0]);
        expect(observedRoutePropParams[1]).toBe(observedRoutePropParams[0]);
        expect(observedRoutePropSearch[1]).toBe(observedRoutePropSearch[0]);

        act(() => {
            root.unmount();
        });
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    });

    it('supports explicit async route component maps without async route collection', async () => {
        const BrowserScreen = () => React.createElement('div');
        const NativeScreen = () => React.createElement('div');
        const route = defineRoute({
            path: '/async/$id',
            component: {
                browser: async (routeApi) => routeApi.component(BrowserScreen),
                reactNative: async (routeApi) => routeApi.component(NativeScreen),
            },
        });
        const descriptors = collectRouteDescriptors([{moduleId: 'AsyncModule', routes: [route]}]);

        expect(descriptors[0].path).toBe('/async/$id');
        await expect(loadSpringboardRouteComponent(descriptors[0], 'browser')).resolves.toEqual({
            status: 'component',
            component: BrowserScreen,
        });
        await expect(loadSpringboardRouteComponent(descriptors[0], 'reactNative')).resolves.toEqual({
            status: 'component',
            component: NativeScreen,
        });
    });

    it('passes a route helper into async component loaders', async () => {
        const InnerScreen = () => React.createElement('div');
        const WrappedScreen = () => React.createElement(InnerScreen);
        const route = defineRoute({
            path: '/async-wrapper',
            component: {
                browser: async (routeApi) => routeApi.component(WrappedScreen),
            },
        });
        const [descriptor] = collectRouteDescriptors([{moduleId: 'AsyncModule', routes: [route]}]);

        await expect(loadSpringboardRouteComponent(descriptor, 'browser')).resolves.toEqual({
            status: 'component',
            component: WrappedScreen,
        });
    });

    it('treats missing platform keys as absent and selected undefined loaders as hard errors', async () => {
        const BrowserScreen = () => React.createElement('div');
        const missingNative = defineRoute({
            path: '/browser-only',
            component: {
                browser: async (routeApi) => routeApi.component(BrowserScreen),
            },
        });
        const undefinedNative = defineRoute({
            path: '/broken-native',
            component: {
                browser: async (routeApi) => routeApi.component(BrowserScreen),
                reactNative: async () => undefined,
            },
        });
        const [missingNativeDescriptor, undefinedNativeDescriptor] = collectRouteDescriptors([
            {moduleId: 'AsyncModule', routes: [missingNative, undefinedNative]},
        ]);

        await expect(loadSpringboardRouteComponent(missingNativeDescriptor, 'reactNative')).resolves.toEqual({
            status: 'absent',
            reason: 'missing-platform-component',
        });
        await expect(loadSpringboardRouteComponent(undefinedNativeDescriptor, 'reactNative')).rejects.toThrow(
            /resolved to undefined/i,
        );
    });

    it('loads the current route first, then background routes, and dedupes loaders', async () => {
        const loadOrder: string[] = [];
        const CurrentScreen = () => React.createElement('div');
        const BackgroundScreen = () => React.createElement('div');
        const current = defineRoute({
            path: '/current',
            component: {
                browser: async () => {
                    loadOrder.push('current');
                    return CurrentScreen;
                },
            },
        });
        const background = defineRoute({
            path: '/background',
            component: {
                browser: async () => {
                    loadOrder.push('background');
                    return BackgroundScreen;
                },
            },
        });
        const descriptors = collectRouteDescriptors([{moduleId: 'AsyncModule', routes: [current, background]}]);

        await preloadSpringboardRouteComponents(descriptors, 'browser', descriptors[0].internalId);
        await preloadSpringboardRouteComponents(descriptors, 'browser', descriptors[0].internalId);

        expect(loadOrder).toEqual(['current', 'background']);
    });
});

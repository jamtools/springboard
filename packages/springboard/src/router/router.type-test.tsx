import React from 'react';

import {
    defineRoute,
    defineRouteComponent,
    defineRoutes,
    getRouteApi,
    useNavigate,
    useParams,
    useSearch,
} from './index';
import * as Router from './index';
import type {ModuleAPI} from '../core/engine/module_api';

const Screen = () => React.createElement('div');

declare module './index' {
    interface RouteSearchRegistry {
        '/': Record<string, unknown>;
        '/settings': Record<string, unknown>;
        '/discounts': {hasDiscount: boolean};
        '/songs/$songId': {tab: 'lyrics' | 'overview'};
        '/async/$id': Record<string, unknown>;
        '/browser-only': Record<string, unknown>;
        '/unvalidated': Record<string, unknown>;
        '/typed-component/$songId': {tab: 'lyrics' | 'overview'};
        '/async-wrapper/$id': {filter: 'active'};
        '/direct-platform-record/$id': {filter: 'active'};
    }
}

const MismatchedSongScreen = defineRouteComponent('/settings', () => React.createElement('div'));
const AsyncRouteWrapperScreen = defineRouteComponent('/async-wrapper/$id', () => React.createElement('div'));
const MismatchedAsyncRouteWrapperScreen = defineRouteComponent('/settings', () => React.createElement('div'));

// @ts-expect-error route components use the path-first canonical API, not generic-only calls.
defineRouteComponent<'/settings'>(() => React.createElement('div'));

const routes = defineRoutes([
    defineRoute({
        path: '/',
        component: {
            browser: async (route) => route.component(Screen),
            reactNative: async (route) => route.component(Screen),
        },
    }),
    defineRoute({
        path: '/settings',
        component: {
            browser: async (route) => route.component(Screen),
            reactNative: async (route) => route.component(Screen),
        },
    }),
    defineRoute({
        path: '/discounts',
        validateSearch: (search) => ({
            hasDiscount: search.hasDiscount === 'true',
        }),
        component: {
            browser: async (route) => route.component(Screen),
            reactNative: async (route) => route.component(Screen),
        },
    }),
    defineRoute({
        path: '/songs/$songId',
        validateSearch: (search) => ({
            tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
        }),
        component: {
            browser: async (route) => route.component(Screen),
            reactNative: async (route) => route.component(Screen),
        },
    }),
    defineRoute({
        path: '/async/$id',
        component: {
            browser: async () => Screen,
            reactNative: async () => Screen,
        },
    }),
    defineRoute({
        path: '/browser-only',
        component: {
            browser: async () => Screen,
        },
    }),
    defineRoute({
        path: '/unvalidated',
        component: {
            browser: async (route) => route.component(Screen),
            reactNative: async (route) => route.component(Screen),
        },
    }),
    defineRoute({
        path: '/typed-component/$songId',
        validateSearch: (search) => ({
            tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
        }),
        component: {
            browser: async (route) => route.component((props) => {
                props.params.songId satisfies string;
                props.search.tab satisfies 'lyrics' | 'overview';
                props.navigate({to: '/settings'});

                // @ts-expect-error route component params are scoped by the declared route path.
                props.params.albumId satisfies string;

                // @ts-expect-error route component search is scoped by validateSearch.
                props.search.tab satisfies 'invalid';

                return React.createElement('div');
            }),
        },
    }),
    defineRoute({
        path: '/async-wrapper/$id',
        validateSearch: (search) => ({
            filter: search.filter === 'active' ? 'active' as const : 'active' as const,
        }),
        component: {
            browser: async (route) => route.component(AsyncRouteWrapperScreen),
        },
    }),
]);

defineRoute({
    path: '/typed-component/$songId',
    component: {
        // @ts-expect-error defineRouteComponent path must match the descriptor path it is assigned to.
        browser: async (route) => route.component(MismatchedSongScreen),
    },
});

defineRoute({
    path: '/async-wrapper/$id',
    validateSearch: (search) => ({
        filter: search.filter === 'active' ? 'active' as const : 'active' as const,
    }),
    component: {
        // @ts-expect-error route.component rejects components whose typed path does not match the containing route.
        browser: async (route) => route.component(MismatchedAsyncRouteWrapperScreen),
    },
});

const makeTypedRoutesModule = async () => ({
    routes,
});
type TypedRoutesModule = Awaited<ReturnType<typeof makeTypedRoutesModule>>;

declare module '../core/module_registry/module_registry' {
    interface AllModules {
        TypedRoutesModule: TypedRoutesModule;
    }
}

const navigate = useNavigate();

navigate({to: '/'});
navigate({to: '/settings'});
navigate({to: '/songs/$songId', params: {songId: 'abc'}});
navigate({to: '/songs/$songId', params: {songId: 'abc'}, search: {tab: 'lyrics'}});
navigate({to: '/async/$id', params: {id: 'typed'}});

// @ts-expect-error missing path param
navigate({to: '/songs/$songId', params: {}});

// @ts-expect-error extra path param
navigate({to: '/songs/$songId', params: {songId: 'abc', extra: 'nope'}});

// @ts-expect-error wrong search value
navigate({to: '/songs/$songId', params: {songId: 'abc'}, search: {tab: 'invalid'}});

// @ts-expect-error unknown route path
navigate({to: '/missing'});

const params = useParams({from: '/songs/$songId'});
params.songId satisfies string;

const search = useSearch({from: '/songs/$songId'});
search.tab satisfies 'lyrics' | 'overview';

const routeApi = getRouteApi('/songs/$songId');
routeApi.useParams().songId satisfies string;
routeApi.useSearch().tab satisfies 'lyrics' | 'overview';

const pathFirstRouteComponent = defineRouteComponent('/songs/$songId', ({params, search}) => {
    params.songId satisfies string;
    search.tab satisfies 'lyrics' | 'overview';

    // @ts-expect-error defineRouteComponent infers search from the path argument and registered route.
    search.tab satisfies 'invalid';

    return React.createElement('div');
});
void pathFirstRouteComponent;

// @ts-expect-error unknown route API path
getRouteApi('/missing');

// @ts-expect-error unknown route component paths are rejected once routes are registered.
defineRouteComponent('/missing', () => React.createElement('div'));

// @ts-expect-error unvalidated search should not pretend to be precise
useSearch({from: '/unvalidated'}).tab satisfies 'lyrics';

defineRoute({
    path: '/direct-platform-record/$id',
    validateSearch: (search) => ({
        filter: search.filter === 'active' ? 'active' as const : 'active' as const,
    }),
    component: {
        browser: async (route) => route.component((props) => {
            props.params.id satisfies string;
            props.search.filter satisfies 'active';

            // @ts-expect-error route.component props are framework-inferred from defineRoute.
            props.search.filter satisfies 'archived';

            return React.createElement('div');
        }),
    },
});

// @ts-expect-error rn is not the MVP platform key; use reactNative
defineRoute({path: '/bad-rn-key', component: {rn: async () => Screen}});

// @ts-expect-error mobile is not the MVP platform key; use reactNative
defineRoute({path: '/bad-mobile-key', component: {mobile: async () => Screen}});

// @ts-expect-error react-native string key is intentionally not the MVP platform key
defineRoute({path: '/bad-react-native-key', component: {'react-native': async () => Screen}});

// @ts-expect-error direct sync components are intentionally not part of the isomorphic route API.
defineRoute({path: '/sync-component', component: Screen});

// @ts-expect-error asyncRouteComponent is intentionally absent; use a direct defineRoute component platform record.
Router.asyncRouteComponent;

// @ts-expect-error raw Promise components are not the explicit async route component API
defineRoute({path: '/raw-promise', component: Promise.resolve(Screen)});

// @ts-expect-error asyncDefineRoute is intentionally absent from the MVP API
Router.asyncDefineRoute;

// @ts-expect-error useQuery is intentionally absent from the Springboard router API
Router.useQuery;

declare const moduleAPI: ModuleAPI;

// @ts-expect-error moduleAPI.ui.registerRoute was removed; modules must return defineRoutes descriptors
moduleAPI.ui.registerRoute;

import React from 'react';

import {
    asyncRouteComponent,
    defineRoute,
    defineRoutes,
    getRouteApi,
    useNavigate,
    useParams,
    useSearch,
} from './index';
import * as Router from './index';
import type {ModuleAPI} from '../core/engine/module_api';

const Screen = () => React.createElement('div');

const routes = defineRoutes([
    defineRoute({path: '/', component: Screen}),
    defineRoute({path: '/settings', component: Screen}),
    defineRoute({
        path: '/discounts',
        component: Screen,
        validateSearch: (search) => ({
            hasDiscount: search.hasDiscount === 'true',
        }),
    }),
    defineRoute({
        path: '/songs/$songId',
        component: Screen,
        validateSearch: (search) => ({
            tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
        }),
    }),
    defineRoute({
        path: '/async/$id',
        component: asyncRouteComponent({
            browser: async () => Screen,
            reactNative: async () => Screen,
        }),
    }),
    defineRoute({
        path: '/browser-only',
        component: asyncRouteComponent({
            browser: async () => Screen,
        }),
    }),
    defineRoute({path: '/unvalidated', component: Screen}),
]);

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

// @ts-expect-error unknown route API path
getRouteApi('/missing');

// @ts-expect-error unvalidated search should not pretend to be precise
useSearch({from: '/unvalidated'}).tab satisfies 'lyrics';

asyncRouteComponent({browser: async () => Screen});
asyncRouteComponent({reactNative: async () => Screen});

// @ts-expect-error rn is not the MVP platform key; use reactNative
asyncRouteComponent({rn: async () => Screen});

// @ts-expect-error mobile is not the MVP platform key; use reactNative
asyncRouteComponent({mobile: async () => Screen});

// @ts-expect-error react-native string key is intentionally not the MVP platform key
asyncRouteComponent({'react-native': async () => Screen});

// @ts-expect-error raw Promise components are not the explicit async route component API
defineRoute({path: '/raw-promise', component: Promise.resolve(Screen)});

// @ts-expect-error asyncDefineRoute is intentionally absent from the MVP API
Router.asyncDefineRoute;

// @ts-expect-error useQuery is intentionally absent from the Springboard router API
Router.useQuery;

declare const moduleAPI: ModuleAPI;

// @ts-expect-error moduleAPI.ui.registerRoute was removed; modules must return defineRoutes descriptors
moduleAPI.ui.registerRoute;

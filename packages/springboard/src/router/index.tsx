import React, {createContext, useContext} from 'react';

import type {AllModules} from '../core/module_registry/module_registry.js';

type UnknownSearch = Record<string, unknown>;
type StringParams = Record<string, string>;

type SearchValidator<TSearch> = (search: UnknownSearch) => TSearch;
export type SpringboardRoutePlatform = 'browser' | 'reactNative';
export type SpringboardRouteComponentLoader = () => React.ComponentType | Promise<React.ComponentType | undefined> | undefined;
export type SpringboardAsyncRouteComponent = {
    readonly __springboardAsyncRouteComponent: true;
    readonly loaders: {
        browser?: SpringboardRouteComponentLoader;
        reactNative?: SpringboardRouteComponentLoader;
    };
};
export type SpringboardRouteComponent = React.ComponentType | SpringboardAsyncRouteComponent;

export type SpringboardRouteConfig<TPath extends string, TSearch> = {
    path: TPath;
    component: SpringboardRouteComponent;
    validateSearch?: SearchValidator<TSearch>;
    params?: {
        parse?: (params: StringParams) => unknown;
        stringify?: (params: unknown) => StringParams;
    };
    options?: {
        documentMeta?: unknown;
        title?: string;
        hideApplicationShell?: boolean;
        presentation?: 'card' | 'modal';
    };
};

export type SpringboardRouteDescriptor<TPath extends string = string, TSearch = UnknownSearch> =
    SpringboardRouteConfig<TPath, TSearch> & {
        readonly __springboardRoute: true;
        readonly __searchType?: TSearch;
    };

export type CollectedSpringboardRouteDescriptor<TPath extends string = string, TSearch = UnknownSearch> =
    SpringboardRouteDescriptor<TPath, TSearch> & {
        moduleId: string;
        normalizedPath: string;
        internalId: string;
    };

// Intentionally empty so applications can declaration-merge their route registry.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Register {}

type AnyRoute = SpringboardRouteDescriptor<string, unknown>;
type RouteTuple = readonly AnyRoute[];
type ExtractModuleRoutes<TModule> = TModule extends {routes?: infer TRoutes}
    ? NonNullable<TRoutes>
    : never;
type FlattenRoutes<TRoutes> = TRoutes extends readonly (infer TRoute)[]
    ? TRoute
    : never;
type ExplicitRegisteredRoutes = Register extends {routes: infer TRoutes}
    ? TRoutes extends RouteTuple
        ? TRoutes
        : never
    : never;
type ModuleRegisteredRouteUnion = FlattenRoutes<{
    [K in keyof AllModules]: ExtractModuleRoutes<AllModules[K]>;
}[keyof AllModules]>;
type ExplicitRegisteredRouteUnion = FlattenRoutes<ExplicitRegisteredRoutes>;
type RouteUnion = [ModuleRegisteredRouteUnion | ExplicitRegisteredRouteUnion] extends [never]
    ? AnyRoute
    : ModuleRegisteredRouteUnion | ExplicitRegisteredRouteUnion;
type RegisteredPath = RouteUnion['path'] & string;
type RouteByPath<TPath extends string> = Extract<RouteUnion, {path: TPath}>;

type SegmentParam<TSegment extends string> = TSegment extends `$${infer TParam}`
    ? TParam
    : never;
type PathParamNames<TPath extends string> =
    string extends TPath
        ? string
        : TPath extends `${infer THead}/${infer TTail}`
            ? SegmentParam<THead> | PathParamNames<TTail>
            : SegmentParam<TPath>;
type PathParams<TPath extends string> = [PathParamNames<TPath>] extends [never]
    ? Record<never, never>
    : {[K in PathParamNames<TPath>]: string};
type SearchFor<TPath extends string> = RouteByPath<TPath> extends SpringboardRouteDescriptor<TPath, infer TSearch>
    ? TSearch
    : UnknownSearch;
type ParamsArg<TPath extends string> = [keyof PathParams<TPath>] extends [never]
    ? {params?: never}
    : {params: PathParams<TPath>};
type SearchArg<TPath extends string> = {search?: SearchFor<TPath>};

export type SpringboardRouteComponentResolution =
    | {status: 'component'; component: React.ComponentType}
    | {status: 'absent'; reason: 'missing-platform-component'};

export type SpringboardNavigateOptions<TPath extends RegisteredPath = RegisteredPath> = {
    to: TPath;
} & ParamsArg<TPath> & SearchArg<TPath>;

export type SpringboardNavigate = <TPath extends RegisteredPath>(options: SpringboardNavigateOptions<TPath>) => void;

type RouterContextValue = {
    routes: readonly CollectedSpringboardRouteDescriptor[];
    currentRouteId?: string;
    pathParams?: StringParams;
    search?: UnknownSearch;
    navigate?: (options: {to: string; params?: StringParams; search?: UnknownSearch}) => void;
};

const SpringboardRouterContext = createContext<RouterContextValue>({
    routes: [],
});

export const useSpringboardRouterContext = (): RouterContextValue => {
    return useContext(SpringboardRouterContext);
};

export const SpringboardRouterProvider = (props: React.PropsWithChildren<RouterContextValue>) => {
    const parent = useSpringboardRouterContext();

    return (
        <SpringboardRouterContext.Provider
            value={{
                routes: props.routes,
                currentRouteId: props.currentRouteId,
                pathParams: props.pathParams,
                search: props.search,
                navigate: props.navigate || parent.navigate,
            }}
        >
            {props.children}
        </SpringboardRouterContext.Provider>
    );
};

export const defineRoute = <const TPath extends string, TSearch = UnknownSearch>(
    config: SpringboardRouteConfig<TPath, TSearch>,
): SpringboardRouteDescriptor<TPath, TSearch> => {
    return {
        ...config,
        path: normalizeRoutePath(config.path) as TPath,
        __springboardRoute: true,
    };
};

export const defineRoutes = <const TRoutes extends RouteTuple>(routes: TRoutes): TRoutes => {
    return routes;
};

export const asyncRouteComponent = (
    loaders: SpringboardAsyncRouteComponent['loaders'],
): SpringboardAsyncRouteComponent => {
    return {
        __springboardAsyncRouteComponent: true,
        loaders: {...loaders},
    };
};

export const isSpringboardAsyncRouteComponent = (
    component: SpringboardRouteComponent,
): component is SpringboardAsyncRouteComponent => {
    return typeof component === 'object'
        && component !== null
        && (component as SpringboardAsyncRouteComponent).__springboardAsyncRouteComponent === true;
};

export const normalizeRoutePath = (path: string): string => {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
    const compacted = withLeadingSlash.replace(/\/+/g, '/');
    if (compacted === '/') {
        return compacted;
    }

    return compacted.replace(/\/$/, '');
};

export const deriveRouteInternalId = (path: string): string => {
    const normalized = normalizeRoutePath(path);
    if (normalized === '/') {
        return 'springboard_route_root';
    }

    const idPart = normalized
        .replace(/^\//, '')
        .replace(/\$/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return `springboard_route_${idPart || 'root'}`;
};

export type RouteDescriptorSource = {
    moduleId: string;
    routes?: readonly SpringboardRouteDescriptor<string, any>[];
};

export const collectRouteDescriptors = (
    modules: readonly RouteDescriptorSource[],
): CollectedSpringboardRouteDescriptor[] => {
    const byPath = new Map<string, CollectedSpringboardRouteDescriptor>();
    const byInternalId = new Map<string, CollectedSpringboardRouteDescriptor>();
    const collected: CollectedSpringboardRouteDescriptor[] = [];

    for (const mod of modules) {
        for (const route of mod.routes || []) {
            const normalizedPath = normalizeRoutePath(route.path);
            const internalId = deriveRouteInternalId(normalizedPath);
            const descriptor: CollectedSpringboardRouteDescriptor = {
                ...route,
                path: normalizedPath,
                normalizedPath,
                internalId,
                moduleId: mod.moduleId,
            };

            const existingPath = byPath.get(normalizedPath);
            if (existingPath) {
                throw new Error(`Duplicate route path "${normalizedPath}" registered by modules "${existingPath.moduleId}" and "${mod.moduleId}".`);
            }

            const existingId = byInternalId.get(internalId);
            if (existingId) {
                throw new Error(`Derived route ID collision "${internalId}" for paths "${existingId.path}" and "${normalizedPath}".`);
            }

            byPath.set(normalizedPath, descriptor);
            byInternalId.set(internalId, descriptor);
            collected.push(descriptor);
        }
    }

    return collected;
};

type CompiledRoutePattern = {
    route: CollectedSpringboardRouteDescriptor;
    segments: string[];
    staticSegmentCount: number;
    dynamicSegmentCount: number;
};

const splitPath = (path: string): string[] => {
    const normalized = normalizeRoutePath(path);
    if (normalized === '/') {
        return [];
    }

    return normalized.replace(/^\//, '').split('/');
};

const compileRoutePattern = (route: CollectedSpringboardRouteDescriptor): CompiledRoutePattern => {
    const segments = splitPath(route.path);
    return {
        route,
        segments,
        staticSegmentCount: segments.filter(segment => !segment.startsWith('$')).length,
        dynamicSegmentCount: segments.filter(segment => segment.startsWith('$')).length,
    };
};

export type RouteMatch = {
    route: CollectedSpringboardRouteDescriptor;
    pathParams: StringParams;
};

export const matchRoute = (
    routes: readonly CollectedSpringboardRouteDescriptor[],
    pathname: string,
): RouteMatch | null => {
    const pathSegments = splitPath(pathname);
    const matches: Array<RouteMatch & {pattern: CompiledRoutePattern; index: number}> = [];

    routes.forEach((route, index) => {
        const pattern = compileRoutePattern(route);
        if (pattern.segments.length !== pathSegments.length) {
            return;
        }

        const pathParams: StringParams = {};
        for (let i = 0; i < pattern.segments.length; i++) {
            const routeSegment = pattern.segments[i]!;
            const pathSegment = pathSegments[i]!;
            if (routeSegment.startsWith('$')) {
                pathParams[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
                continue;
            }

            if (routeSegment !== pathSegment) {
                return;
            }
        }

        matches.push({route, pathParams, pattern, index});
    });

    matches.sort((a, b) => {
        return b.pattern.staticSegmentCount - a.pattern.staticSegmentCount
            || a.pattern.dynamicSegmentCount - b.pattern.dynamicSegmentCount
            || b.pattern.segments.length - a.pattern.segments.length
            || a.index - b.index;
    });

    return matches[0] || null;
};

export const interpolatePath = (path: string, params: StringParams = {}): string => {
    const segments = splitPath(path);
    if (segments.length === 0) {
        return '/';
    }

    const interpolated = segments.map(segment => {
        if (!segment.startsWith('$')) {
            return segment;
        }

        const paramName = segment.slice(1);
        const value = params[paramName];
        if (value === undefined) {
            throw new Error(`Missing path param "${paramName}" for route "${path}".`);
        }

        return encodeURIComponent(value);
    });

    return `/${interpolated.join('/')}`;
};

export const normalizeSearch = <TSearch,>(
    route: SpringboardRouteDescriptor<string, TSearch>,
    search: UnknownSearch = {},
): TSearch | UnknownSearch => {
    return route.validateSearch ? route.validateSearch(search) : search;
};

const routeComponentCache = new WeakMap<SpringboardAsyncRouteComponent, Map<SpringboardRoutePlatform, Promise<SpringboardRouteComponentResolution>>>();

const getLoaderForPlatform = (
    asyncComponent: SpringboardAsyncRouteComponent,
    platform: SpringboardRoutePlatform,
): SpringboardRouteComponentLoader | undefined => {
    return asyncComponent.loaders[platform];
};

export const loadSpringboardRouteComponent = async (
    route: SpringboardRouteDescriptor,
    platform: SpringboardRoutePlatform,
): Promise<SpringboardRouteComponentResolution> => {
    if (!isSpringboardAsyncRouteComponent(route.component)) {
        return {
            status: 'component',
            component: route.component,
        };
    }

    const loader = getLoaderForPlatform(route.component, platform);
    if (!loader) {
        return {
            status: 'absent',
            reason: 'missing-platform-component',
        };
    }

    let platformCache = routeComponentCache.get(route.component);
    if (!platformCache) {
        platformCache = new Map();
        routeComponentCache.set(route.component, platformCache);
    }

    const cached = platformCache.get(platform);
    if (cached) {
        return cached;
    }

    const promise = Promise.resolve()
        .then(loader)
        .then((component): SpringboardRouteComponentResolution => {
            if (component === undefined) {
                throw new Error(`Async route component for "${route.path}" on "${platform}" resolved to undefined. Omit the platform key to mark the component absent.`);
            }

            if (typeof component !== 'function') {
                throw new Error(`Async route component for "${route.path}" on "${platform}" resolved to a non-component value.`);
            }

            return {
                status: 'component',
                component,
            };
        });

    platformCache.set(platform, promise);
    return promise;
};

export const preloadSpringboardRouteComponents = async (
    routes: readonly SpringboardRouteDescriptor[],
    platform: SpringboardRoutePlatform,
    currentRouteId?: string,
): Promise<void> => {
    const currentRoute = currentRouteId
        ? routes.find(route => 'internalId' in route && route.internalId === currentRouteId)
        : undefined;
    const backgroundRoutes = currentRoute
        ? routes.filter(route => route !== currentRoute)
        : routes;

    if (currentRoute) {
        await loadSpringboardRouteComponent(currentRoute, platform);
    }

    await Promise.all(backgroundRoutes.map(route => loadSpringboardRouteComponent(route, platform)));
};

export const resolveRegisteredRoute = (
    routes: readonly CollectedSpringboardRouteDescriptor[],
    path: string,
): CollectedSpringboardRouteDescriptor => {
    const normalizedPath = normalizeRoutePath(path);
    const route = routes.find(candidate => candidate.path === normalizedPath);
    if (!route) {
        throw new Error(`Route "${normalizedPath}" is typed but is not registered at runtime.`);
    }

    return route;
};

export const useNavigate = (): SpringboardNavigate => {
    const context = useSpringboardRouterContext();

    return ((options: {to: string; params?: StringParams; search?: UnknownSearch}) => {
        const route = resolveRegisteredRoute(context.routes, options.to);
        interpolatePath(route.path, options.params);

        context.navigate?.({
            to: route.path,
            params: options.params,
            search: options.search,
        });
    }) as SpringboardNavigate;
};

export const useParams = <TPath extends RegisteredPath,>(options: {from: TPath}): PathParams<TPath> => {
    const context = useSpringboardRouterContext();
    resolveRegisteredRoute(context.routes, options.from);

    return (context.pathParams || {}) as PathParams<TPath>;
};

export const useSearch = <TPath extends RegisteredPath,>(options: {from: TPath}): SearchFor<TPath> => {
    const context = useSpringboardRouterContext();
    resolveRegisteredRoute(context.routes, options.from);

    return (context.search || {}) as SearchFor<TPath>;
};

export const getRouteApi = <TPath extends RegisteredPath,>(path: TPath) => {
    return {
        useParams: () => useParams({from: path}),
        useSearch: () => useSearch({from: path}),
    };
};

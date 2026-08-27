import React, {createContext, useContext, useMemo, useState} from 'react';
import {NavigationContainer, useNavigation, useRoute} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {Text, View} from 'react-native';

import {useSpringboardEngine} from '../../../core/engine/engine.js';
import {
    CollectedSpringboardRouteDescriptor,
    SpringboardRoutePlatform,
    SpringboardRouterProvider,
    collectRouteDescriptors,
    interpolatePath,
    isSpringboardAsyncRouteComponent,
    loadSpringboardRouteComponent,
    normalizeSearch,
    preloadSpringboardRouteComponents,
    useSpringboardRouterContext,
} from '../../../router/index.js';

export type SpringboardRNRouteParams = {
    __springboardRouteId?: string;
    __springboardPathParams?: Record<string, string>;
    __springboardSearch?: Record<string, unknown>;
    [key: string]: unknown;
};

type RootStackParamList = Record<string, SpringboardRNRouteParams>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export type SpringboardWebViewTarget =
    | {kind: 'remote'; url: string}
    | {kind: 'local'; uri: string};

export type SpringboardWebViewTargetResolverContext = {
    reason: 'missing-native-component';
    route: CollectedSpringboardRouteDescriptor;
    routeId: string;
    path: string;
    routePath: string;
    concretePath: string;
    pathParams: Record<string, string>;
    search: Record<string, unknown>;
    platform: SpringboardRoutePlatform;
};

export type SpringboardWebViewTargetResolver = (
    context: SpringboardWebViewTargetResolverContext,
) => SpringboardWebViewTarget | null | undefined | Promise<SpringboardWebViewTarget | null | undefined>;

type ReactNativeRoutingOptions = {
    resolveWebViewTarget?: SpringboardWebViewTargetResolver;
    renderWebViewTarget?: (
        target: SpringboardWebViewTarget,
        context: SpringboardWebViewTargetResolverContext,
    ) => React.ReactNode;
};

const ReactNativeRoutingOptionsContext = createContext<ReactNativeRoutingOptions>({});

const assertValidWebViewTarget = (
    target: SpringboardWebViewTarget | null | undefined,
    descriptor: CollectedSpringboardRouteDescriptor,
): SpringboardWebViewTarget => {
    if (!target) {
        throw new Error(`Missing WebView target for route "${descriptor.path}".`);
    }

    if (target.kind === 'remote' && typeof target.url === 'string' && target.url.length > 0) {
        return target;
    }

    if (target.kind === 'local' && typeof target.uri === 'string' && target.uri.length > 0) {
        return target;
    }

    throw new Error(`Invalid WebView target for route "${descriptor.path}".`);
};

const getWebViewTargetSource = (target: SpringboardWebViewTarget): string => {
    return target.kind === 'remote' ? target.url : target.uri;
};

const SpringboardWebViewFallback = (props: {target: SpringboardWebViewTarget}) => {
    return (
        <View
            testID="springboard-webview-fallback"
            accessibilityLabel={getWebViewTargetSource(props.target)}
        >
            <Text>{props.target.kind}</Text>
            <Text>{getWebViewTargetSource(props.target)}</Text>
        </View>
    );
};

const getWebViewResolverContext = (
    descriptor: CollectedSpringboardRouteDescriptor,
    pathParams: Record<string, string>,
    search: Record<string, unknown>,
): SpringboardWebViewTargetResolverContext => {
    return {
        reason: 'missing-native-component',
        route: descriptor,
        routeId: descriptor.internalId,
        path: descriptor.path,
        routePath: descriptor.path,
        concretePath: interpolatePath(descriptor.path, pathParams),
        pathParams,
        search,
        platform: 'reactNative',
    };
};

export const springboardPathToReactNavigationPath = (path: string): string => {
    if (path === '/') {
        return '';
    }

    return path
        .replace(/^\//, '')
        .split('/')
        .map(segment => segment.startsWith('$') ? `:${segment.slice(1)}` : segment)
        .join('/');
};

const resolveRouteById = (
    routes: readonly CollectedSpringboardRouteDescriptor[],
    routeId: string,
): CollectedSpringboardRouteDescriptor => {
    const descriptor = routes.find(candidate => candidate.internalId === routeId);
    if (!descriptor) {
        throw new Error(`React Navigation route "${routeId}" is not registered in the Springboard descriptor registry.`);
    }

    return descriptor;
};

const getPathParamNames = (path: string): string[] => {
    return path
        .replace(/^\//, '')
        .split('/')
        .filter(segment => segment.startsWith('$'))
        .map(segment => segment.slice(1));
};

const getReactNavigationRouteName = (route: ReturnType<typeof useRoute>): string | undefined => {
    return (route as {name?: string}).name;
};

const getPathParams = (
    descriptor: CollectedSpringboardRouteDescriptor,
    params: SpringboardRNRouteParams,
): Record<string, string> => {
    if (params.__springboardPathParams) {
        return params.__springboardPathParams;
    }

    return Object.fromEntries(
        getPathParamNames(descriptor.path)
            .filter(paramName => params[paramName] !== undefined)
            .map(paramName => [paramName, String(params[paramName])]),
    );
};

const getSearchParams = (
    descriptor: CollectedSpringboardRouteDescriptor,
    params: SpringboardRNRouteParams,
): Record<string, unknown> => {
    if (params.__springboardSearch) {
        return params.__springboardSearch;
    }

    const pathParamNames = new Set(getPathParamNames(descriptor.path));
    return Object.fromEntries(
        Object.entries(params).filter(([key]) => (
            !key.startsWith('__springboard')
            && !pathParamNames.has(key)
        )),
    );
};

const getSearchContext = (
    descriptor: CollectedSpringboardRouteDescriptor,
    params: SpringboardRNRouteParams,
): Record<string, unknown> => {
    if (params.__springboardSearch) {
        return params.__springboardSearch;
    }

    return normalizeSearch(descriptor, getSearchParams(descriptor, params)) as Record<string, unknown>;
};

const SpringboardRouteContent = (props: {
    descriptor: CollectedSpringboardRouteDescriptor;
    pathParams: Record<string, string>;
    search: Record<string, unknown>;
}) => {
    const {renderWebViewTarget, resolveWebViewTarget} = useContext(ReactNativeRoutingOptionsContext);
    const webViewResolverContext = useMemo(() => getWebViewResolverContext(
        props.descriptor,
        props.pathParams,
        props.search,
    ), [props.descriptor, props.pathParams, props.search]);
    const routeComponent = useQuery({
        queryKey: ['springboard-route-component', 'reactNative', props.descriptor.internalId],
        queryFn: () => loadSpringboardRouteComponent(props.descriptor, 'reactNative'),
        enabled: isSpringboardAsyncRouteComponent(props.descriptor.component),
        staleTime: Infinity,
        gcTime: Infinity,
    });
    const webViewTarget = useQuery({
        queryKey: ['springboard-webview-target', props.descriptor.internalId, props.pathParams, props.search],
        queryFn: async () => {
            if (!resolveWebViewTarget) {
                throw new Error(`Route "${props.descriptor.path}" has no React Native component and no WebView target resolver was provided.`);
            }

            return assertValidWebViewTarget(await resolveWebViewTarget(webViewResolverContext), props.descriptor);
        },
        enabled: routeComponent.data?.status === 'absent',
        staleTime: Infinity,
        gcTime: Infinity,
    });

    if (!isSpringboardAsyncRouteComponent(props.descriptor.component)) {
        return React.createElement(props.descriptor.component);
    }

    if (routeComponent.isPending) {
        return <Text testID="springboard-route-loading">Loading route…</Text>;
    }

    if (routeComponent.isError) {
        return <Text role="alert">{routeComponent.error.message}</Text>;
    }

    if (routeComponent.data.status === 'component') {
        return React.createElement(routeComponent.data.component);
    }

    if (webViewTarget.isPending) {
        return <Text testID="springboard-route-loading">Loading route…</Text>;
    }

    if (webViewTarget.isError) {
        return <Text role="alert">{webViewTarget.error.message}</Text>;
    }

    if (renderWebViewTarget) {
        return <>{renderWebViewTarget(webViewTarget.data, webViewResolverContext)}</>;
    }

    return <SpringboardWebViewFallback target={webViewTarget.data} />;
};

export const StableSpringboardScreen = () => {
    const {routes} = useSpringboardRouterContext();
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params || {}) as SpringboardRNRouteParams;
    const routeId = params.__springboardRouteId || getReactNavigationRouteName(route);

    if (!routeId) {
        throw new Error('Missing Springboard route ID in React Navigation params.');
    }

    const descriptor = resolveRouteById(routes, routeId);
    const pathParams = getPathParams(descriptor, params);
    const search = getSearchContext(descriptor, params);

    return (
        <SpringboardRouterProvider
            routes={routes}
            currentRouteId={descriptor.internalId}
            pathParams={pathParams}
            search={search}
            navigate={(options) => {
                const target = routes.find(candidate => candidate.path === options.to);
                if (!target) {
                    throw new Error(`Route "${options.to}" is typed but is not registered at runtime.`);
                }

                (navigation as {navigate: (name: string, params: SpringboardRNRouteParams) => void}).navigate(target.internalId, {
                    __springboardRouteId: target.internalId,
                    __springboardPathParams: options.params,
                    __springboardSearch: normalizeSearch(target, options.search),
                });
            }}
        >
            <SpringboardRouteContent descriptor={descriptor} pathParams={pathParams} search={search} />
        </SpringboardRouterProvider>
    );
};

export const SpringboardNavigationStack = (props: {routes?: readonly CollectedSpringboardRouteDescriptor[]; queryClient?: QueryClient}) => {
    const engine = useSpringboardEngine();
    const modules = engine.moduleRegistry.useModules();
    const collectedRoutes = useMemo(() => collectRouteDescriptors(modules), [modules]);
    const routes = props.routes || collectedRoutes;
    const queryClient = props.queryClient;

    React.useEffect(() => {
        void queryClient?.prefetchQuery({
            queryKey: ['springboard-route-preload', 'reactNative', routes.map(route => route.internalId).join('|')],
            queryFn: async () => {
                await preloadSpringboardRouteComponents(routes, 'reactNative', routes[0]?.internalId);
                return true;
            },
            staleTime: Infinity,
            gcTime: Infinity,
        }).catch(() => undefined);
    }, [queryClient, routes]);

    return (
        <SpringboardRouterProvider routes={routes}>
            <Stack.Navigator id="springboard-root-stack">
                {routes.map(route => (
                    <Stack.Screen
                        key={route.internalId}
                        name={route.internalId}
                        initialParams={{__springboardRouteId: route.internalId}}
                        component={StableSpringboardScreen}
                    />
                ))}
            </Stack.Navigator>
        </SpringboardRouterProvider>
    );
};

export const createSpringboardLinkingConfig = (
    routes: readonly CollectedSpringboardRouteDescriptor[],
    prefixes: readonly string[] = [],
) => {
    return {
        prefixes: [...prefixes],
        config: {
            screens: Object.fromEntries(
                routes.map(route => [
                    route.internalId,
                    springboardPathToReactNavigationPath(route.path),
                ]),
            ),
        },
    };
};

export const SpringboardReactNavigationHost = (props: {
    linkingPrefixes?: readonly string[];
    renderWebViewTarget?: ReactNativeRoutingOptions['renderWebViewTarget'];
    resolveWebViewTarget?: SpringboardWebViewTargetResolver;
} = {}) => {
    const engine = useSpringboardEngine();
    const modules = engine.moduleRegistry.useModules();
    const routes = useMemo(() => collectRouteDescriptors(modules), [modules]);
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <ReactNativeRoutingOptionsContext.Provider
                value={{
                    renderWebViewTarget: props.renderWebViewTarget,
                    resolveWebViewTarget: props.resolveWebViewTarget,
                }}
            >
                <NavigationContainer linking={createSpringboardLinkingConfig(routes, props.linkingPrefixes)}>
                    <SpringboardNavigationStack routes={routes} queryClient={queryClient} />
                </NavigationContainer>
            </ReactNativeRoutingOptionsContext.Provider>
        </QueryClientProvider>
    );
};

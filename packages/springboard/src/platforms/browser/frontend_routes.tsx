import React, {useEffect, useMemo, useState} from 'react';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {
    AnyRoute,
    Link,
    RouterProvider,
    createRoute,
    createRouter,
} from '@tanstack/react-router';

import {useSpringboardEngine} from '../../core/engine/engine.js';
import {Module} from '../../core/module_registry/module_registry.js';
import {
    CollectedSpringboardRouteDescriptor,
    SpringboardRouterProvider,
    collectRouteDescriptors,
    isSpringboardAsyncRouteComponent,
    loadSpringboardRouteComponent,
    matchRoute,
    preloadSpringboardRouteComponents,
} from '../../router/index.js';
import {rootRoute} from '../../core/ui/root_route.js';
import {Layout} from './layout.js';

type AllRoutesFlat = readonly AnyRoute[];

function createAppRouter(routes: AllRoutesFlat) {
    const routeTree = rootRoute.addChildren(routes);

    return createRouter({
        routeTree,
        context: {},
        defaultPreload: 'intent',
        scrollRestoration: true,
        defaultStructuralSharing: true,
        defaultPreloadStaleTime: 0,
    });
}

type AppRouter = ReturnType<typeof createAppRouter>;

const BrowserRouteContent = (props: {descriptor: CollectedSpringboardRouteDescriptor}) => {
    const routeComponent = useQuery({
        queryKey: ['springboard-route-component', 'browser', props.descriptor.internalId],
        queryFn: () => loadSpringboardRouteComponent(props.descriptor, 'browser'),
        enabled: isSpringboardAsyncRouteComponent(props.descriptor.component),
        staleTime: Infinity,
        gcTime: Infinity,
    });

    if (!isSpringboardAsyncRouteComponent(props.descriptor.component)) {
        return React.createElement(props.descriptor.component);
    }

    if (routeComponent.isPending) {
        return <div>Loading route…</div>;
    }

    if (routeComponent.isError) {
        return <div role="alert">{routeComponent.error.message}</div>;
    }

    if (routeComponent.data.status === 'absent') {
        return <div role="alert">Route "{props.descriptor.path}" has no browser component.</div>;
    }

    return React.createElement(routeComponent.data.component);
};

const SpringboardTanStackRoutes = (props: {queryClient: QueryClient}) => {
    const engine = useSpringboardEngine();
    const mods = engine.moduleRegistry.useModules();

    const {descriptors, router} = useMemo(() => {
        const descriptors = collectRouteDescriptors(mods);
        const compiledRoutes = descriptors.map(descriptor => {
            const route = createRoute({
                path: descriptor.path,
                getParentRoute: () => rootRoute,
                params: descriptor.params as never,
                validateSearch: descriptor.validateSearch,
                component: () => {
                    const pathParams = route.useParams() as Record<string, string>;
                    const search = route.useSearch() as Record<string, unknown>;

                    return (
                        <SpringboardRouterProvider
                            routes={descriptors}
                            currentRouteId={descriptor.internalId}
                            pathParams={pathParams}
                            search={search}
                        >
                            <Layout modules={mods}>
                                <BrowserRouteContent descriptor={descriptor} />
                            </Layout>
                        </SpringboardRouterProvider>
                    );
                },
            });

            return route;
        });
        const routesIndexRoute = createRoute({
            path: '/routes',
            getParentRoute: () => rootRoute,
            component: () => (
                <Layout modules={mods}>
                    <RootPath modules={mods} />
                </Layout>
            ),
        });

        if (!descriptors.some(route => route.path === '/')) {
            compiledRoutes.push(createRoute({
                path: '/',
                getParentRoute: () => rootRoute,
                component: () => (
                    <Layout modules={mods}>
                        <RootPath modules={mods} />
                    </Layout>
                ),
            }));
        }

        return {
            descriptors,
            router: createAppRouter([...compiledRoutes, routesIndexRoute] as unknown as AllRoutesFlat),
        };
    }, [mods]);

    useEffect(() => {
        const currentRouteId = typeof window === 'undefined'
            ? descriptors[0]?.internalId
            : matchRoute(descriptors, window.location.pathname)?.route.internalId || descriptors[0]?.internalId;

        void props.queryClient.prefetchQuery({
            queryKey: ['springboard-route-preload', 'browser', descriptors.map(route => route.internalId).join('|')],
            queryFn: async () => {
                await preloadSpringboardRouteComponents(descriptors, 'browser', currentRouteId);
                return true;
            },
            staleTime: Infinity,
            gcTime: Infinity,
        }).catch(() => undefined);
    }, [descriptors, props.queryClient]);

    if (typeof window !== 'undefined') {
        (window as any).tsRouter = router;
    }

    return (
        <SpringboardRouterProvider
            routes={descriptors}
            navigate={(options) => {
                router.navigate({
                    to: options.to,
                    params: options.params,
                    search: options.search,
                } as never);
            }}
        >
            <RouterProvider router={router} />
        </SpringboardRouterProvider>
    );
};

export const FrontendRoutes = () => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <SpringboardTanStackRoutes queryClient={queryClient} />
        </QueryClientProvider>
    );
};

declare module '@tanstack/react-router' {
    interface Register {
        router: AppRouter;
    }
}

const RootPath = (props: {modules: Module[]}) => {
    return (
        <ul>
            {props.modules.map(mod => (
                <RenderModuleRoutes
                    key={mod.moduleId}
                    mod={mod}
                />
            ))}
        </ul>
    );
};

const RenderModuleRoutes = ({mod}: {mod: Module}) => {
    return (
        <li>
            {mod.moduleId}
            <ul>
                {mod.routes?.map(route => (
                    <li key={route.path}>
                        <Link
                            data-testid={`link-to-${route.path}`}
                            to={route.path}
                        >
                            {route.path || '/'}
                        </Link>
                    </li>
                ))}
            </ul>
        </li>
    );
};

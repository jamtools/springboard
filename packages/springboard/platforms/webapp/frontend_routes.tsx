import React from 'react';

import {
    createBrowserRouter,
    createHashRouter,
    Link,
    RouteObject,
    RouterProvider,
    useNavigate,
} from 'react-router';

import {useSpringboardEngine} from 'springboard/engine/engine';
import {Module, RegisteredRoute} from 'springboard/module_registry/module_registry';

import {Layout} from './layout';

const CustomRoute = (props: {component: RegisteredRoute['component']}) => {
    const navigate = useNavigate();

    return (
        <props.component
            navigate={navigate}
        />
    );
};

export const FrontendRoutes = () => {
    const engine = useSpringboardEngine();

    const mods = engine.moduleRegistry.useModules();

    const moduleRoutes: RouteObject[] = [];

    const rootRouteObjects: RouteObject[] = [];

    for (const mod of mods) {
        if (!mod.routes) {
            continue;
        }

        const routes = mod.routes;

        const thisModRoutes: RouteObject[] = [];

        Object.keys(routes).forEach(path => {
            const Component = routes[path].component;
            const routeObject: RouteObject = {
                path,
                element: (
                    <Layout modules={mods}>
                        <CustomRoute component={Component}/>
                    </Layout>
                ),
            };

            if (path.startsWith('/')) {
                rootRouteObjects.push(routeObject);
            } else {
                thisModRoutes.push(routeObject);
            }
        });

        if (thisModRoutes.length) {
            moduleRoutes.push({
                path: mod.moduleId,
                children: thisModRoutes,
            });
        }
    }

    moduleRoutes.push({
        path: '*',
        element: <span/>,
    });

    const routerContructor = (globalThis as {useHashRouter?: boolean}).useHashRouter ? createHashRouter : createBrowserRouter;

    const allRoutes: RouteObject[] = [
        ...rootRouteObjects,
        {
            path: '/modules',
            children: moduleRoutes,
        },
        {
            path: '/routes',
            element: <Layout modules={mods}><RootPath modules={mods}/></Layout>
        },
    ];

    if (!rootRouteObjects.find(r => r.path === '/')) {
        allRoutes.push({
            path: '/',
            element: <Layout modules={mods}><RootPath modules={mods}/></Layout>
        });
    }

    const router = routerContructor(allRoutes, {
        future: {
            v7_relativeSplatPath: true,
            // v7_startTransition: true,
        },
    });

    return (
        <RouterProvider router={router}/>
    );
};

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
                {mod.routes && Object.keys(mod.routes).map(path => {
                    let suffix = '';
                    if (path && path !== '/') {
                        if (!path.startsWith('/')) {
                            suffix += '/';
                        }

                        if (path.endsWith('/')) {
                            suffix += path.substring(0, path.length - 1);
                        } else {
                            suffix += path;
                        }
                    }

                    const href = path.startsWith('/') ? path : `/modules/${mod.moduleId}${suffix}`;

                    return (
                        <li key={path}>
                            <Link
                                data-testid={`link-to-${href}`}
                                to={href}
                            >
                                {path || '/'}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </li>
    );
};

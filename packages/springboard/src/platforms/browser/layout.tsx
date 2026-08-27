import React from 'react';

import {Module} from '../../core/module_registry/module_registry.js';
import {collectRouteDescriptors, matchRoute} from '../../router/index.js';

type Props = React.PropsWithChildren<{
    modules: Module[];
}>;

const useApplicationShell = (modules: Module[]) => {
    const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;

    for (const mod of modules) {
        if (!mod.routes) {
            continue;
        }

        const matchedRoute = matchRoute(collectRouteDescriptors([{
            moduleId: mod.moduleId,
            routes: mod.routes,
        }]), pathname);
        if (matchedRoute?.route.options?.hideApplicationShell) {
            return null;
        }
    }

    for (const mod of modules) {
        if (mod.applicationShell) {
            return mod.applicationShell;
        }
    }

    return null;
};

export const Layout = (props: Props) => {
    const ApplicationShell = useApplicationShell(props.modules);

    if (!ApplicationShell) {
        return props.children;
    }

    return (
        <ApplicationShell
            modules={props.modules}
        >
            {props.children}
        </ApplicationShell>
    );
};

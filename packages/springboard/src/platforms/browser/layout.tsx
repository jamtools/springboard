import React from 'react';

import {useLocation, matchPath} from 'react-router';

import {Module} from '../../core/module_registry/module_registry.js';

type Props = React.PropsWithChildren<{
    modules: Module[];
}>;

const useApplicationShell = (modules: Module[]) => {
    const loc = useLocation();
    let pathname = loc.pathname;
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }

    for (const mod of modules) {
        if (!mod.routes) {
            continue;
        }

        for (const route of mod.routes) {
            if (matchPath(route.path, loc.pathname)) {
                const options = route.options;
                if (options?.hideApplicationShell) {
                    return null;
                }
            }
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

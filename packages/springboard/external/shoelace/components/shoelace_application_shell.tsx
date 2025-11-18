import React, {useState} from 'react';

import {useLocation, useNavigate} from 'react-router';

import SlTab from '@shoelace-style/shoelace/dist/react/tab/index.js';
import SlTabGroup from '@shoelace-style/shoelace/dist/react/tab-group/index.js';
import SlTabPanel from '@shoelace-style/shoelace/dist/react/tab-panel/index.js';
import {RunLocalButton} from '@springboardjs/platforms-browser/components/run_local_button';
import {Module} from 'springboard/module_registry/module_registry';

type Props = React.PropsWithChildren<{
    modules: Module[];
}>;

export const ShoelaceApplicationShell = (props: Props) => {
    return (
        <>
            <ToggleThemeButton />
            <RunLocalButton />
            <details>
                <summary>Navigation</summary>
                <Tabs modules={props.modules} />
            </details>
            {props.children}
        </>
    );
};

if (typeof document !== 'undefined') {
    document.documentElement.classList.add('sl-theme-light');
}

const ToggleThemeButton = () => {
    const onClick = () => {
        const classList = document.documentElement.classList;
        for (const cls of classList) {
            if (cls === 'sl-theme-light') {
                classList.add('sl-theme-dark');
                classList.remove(cls);
                return;
            } else if (cls === 'sl-theme-dark') {
                classList.add('sl-theme-light');
                classList.remove(cls);
                return;
            }
        }
    };

    return (
        <button onClick={onClick}>
            Toggle theme
        </button>
    );
};

type TabsProps = {
    modules: Module[];
}

const Tabs = (props: TabsProps) => {
    const loc = useLocation();
    const navigate = useNavigate();

    const [initialLoc] = useState(loc.pathname);
    let moduleId = '';
    let subpath = '';

    const parsed = initialLoc.split('/');
    if (parsed.includes('modules')) {
        const modId = parsed[parsed.indexOf('modules') + 1];
        if (modId) {
            moduleId = modId;
            const sub = parsed.slice(parsed.indexOf('modules') + 2).join('/');
            if (sub) {
                subpath = sub;
            }
        }
    }

    const showRoute = (modId: string, route: string) => {
        if (route.startsWith('/')) {
            navigate(route);
            return;
        }
        navigate(`/modules/${modId}/${route}`);
    };

    const modulesWithRoutes = props.modules.filter(m => m.routes).map(m => (
        <React.Fragment key={m.moduleId}>
            <SlTab
                slot="nav"
                data-testid={`navbar_module_link-${m.moduleId}`}
                panel={m.moduleId}
                active={m.moduleId === moduleId}
                onClick={() => {
                    if (m.routes && '/' in m.routes) {
                        showRoute(m.moduleId, '/');
                    } else if (m.routes && '' in m.routes) {
                        showRoute(m.moduleId, '');
                    }
                }}
            >
                {m.moduleId}
            </SlTab>

            <SlTabPanel name={m.moduleId}>
                <SlTabGroup>
                    {Object.keys((m.routes || {})).map(route => (
                        <React.Fragment key={route}>
                            <SlTab
                                slot={'nav'}
                                panel={route}
                                active={m.moduleId === moduleId && route === subpath}
                                onClick={() => showRoute(m.moduleId, route)}
                            >
                                {route || 'Home'}
                            </SlTab>
                        </React.Fragment>
                    ))}
                </SlTabGroup>
            </SlTabPanel>
        </React.Fragment>
    ));

    return (
        <>
            <div>
                {modulesWithRoutes}
            </div>
        </>
    );
};

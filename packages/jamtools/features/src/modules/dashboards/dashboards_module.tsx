import React from 'react';

import springboard from 'springboard';
import {defineRoute, defineRoutes, useNavigate, SpringboardRouteDescriptor} from 'springboard/router';

import {ModuleAPI} from 'springboard/engine/module_api';

import allDashboards from '.';

export type RegisteredDashboard = {
    dashboard: (moduleAPI: ModuleAPI, dashboardId: string) => Promise<readonly SpringboardRouteDescriptor<string, any>[]>;
    id: string;
    label: string;
}

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        Dashboards: DashboardsModuleReturnValue;
    }
}

type DashboardsModuleReturnValue = {
    routes: ReturnType<typeof defineRoutes>;
};

springboard.registerModule('Dashboards', {}, async (moduleAPI): Promise<DashboardsModuleReturnValue> => {
    const dashboardRoutes = (await Promise.all(allDashboards.map(d => d.dashboard(moduleAPI, d.id)))).flat();

    const DashboardsRoute = () => {
        const navigate = useNavigate();

        return (
            <div>
                <h2>Dashboards:</h2>
                <ul>
                    {allDashboards.map(d => (
                        <li key={d.id}>
                            <button onClick={() => navigate({to: `/modules/Dashboards/${d.id}`} as never)}>
                                {d.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return {
        routes: defineRoutes([
            defineRoute({
                path: '/modules/Dashboards',
                component: DashboardsRoute,
            }),
            ...dashboardRoutes,
        ]),
    };
});

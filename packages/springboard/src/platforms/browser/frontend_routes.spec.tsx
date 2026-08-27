import React from 'react';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import springboard from '../../core/engine/register.js';
import {SpringboardProviderPure} from '../../core/engine/engine.js';
import {makeMockSpringboardEngine} from '../../core/test/mock_core_dependencies.js';
import {defineRoute, defineRouteComponent, defineRoutes} from '../../router/index.js';
import {FrontendRoutes} from './frontend_routes.js';

const RootBrowserRoute = defineRouteComponent<'/'>(({navigate}) => (
    <main>
        <h1>Springboard web routing root</h1>
        <button onClick={() => navigate({to: '/web-static'})}>
            Open web static route
        </button>
    </main>
));

const StaticBrowserRoute = defineRouteComponent<'/web-static'>(() => (
    <main>
        <h1>Springboard web static route</h1>
    </main>
));

const browserRoutingE2EModule = springboard.defineModule('BrowserRoutingE2E', {}, async () => ({
    routes: defineRoutes([
        defineRoute({
            path: '/',
            component: {
                browser: async (route) => route.component(RootBrowserRoute),
                reactNative: async (route) => route.component(RootBrowserRoute),
            },
        }),
        defineRoute({
            path: '/web-static',
            component: {
                browser: async (route) => route.component(StaticBrowserRoute),
                reactNative: async (route) => route.component(StaticBrowserRoute),
            },
        }),
    ]),
}));

let originalScrollTo: typeof window.scrollTo;

beforeEach(() => {
    originalScrollTo = window.scrollTo;
    Object.defineProperty(window, 'scrollTo', {
        configurable: true,
        value: () => undefined,
    });
});

describe('Springboard browser routing E2E', () => {
    it('renders the initial route and navigates to another route through the web adapter', async () => {
        window.history.replaceState({}, '', '/');
        const engine = await makeMockSpringboardEngine({
            descriptors: browserRoutingE2EModule,
        });

        render(
            <SpringboardProviderPure engine={engine}>
                <FrontendRoutes />
            </SpringboardProviderPure>,
        );

        expect(await screen.findByRole('heading', {name: 'Springboard web routing root'})).toBeTruthy();

        await userEvent.click(screen.getByRole('button', {name: 'Open web static route'}));

        expect(await screen.findByRole('heading', {name: 'Springboard web static route'})).toBeTruthy();
    });
});

afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'scrollTo', {
        configurable: true,
        value: originalScrollTo,
    });
});

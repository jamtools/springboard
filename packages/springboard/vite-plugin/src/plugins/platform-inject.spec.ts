import {describe, expect, it} from 'vitest';

import {transformAsyncRouteComponentBranches} from './platform-inject';

describe('transformAsyncRouteComponentBranches', () => {
    it('removes reactNative route imports from direct defineRoute platform records for browser builds', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: {
        browser: async (route) => route.component((await import('./BrowserRoute')).BrowserRoute),
        reactNative: async (route) => route.component((await import('./NativeRoute')).NativeRoute),
    },
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'web');

        expect(transformed).toContain("import('./BrowserRoute')");
        expect(transformed).not.toContain("import('./NativeRoute')");
    });

    it('removes browser route imports from direct defineRoute platform records for React Native builds', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: {
        browser: async (route) => route.component((await import('./BrowserRoute')).default),
        reactNative: async (route) => route.component((await import('./NativeRoute')).NativeRoute),
    },
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'react-native');

        expect(transformed).not.toContain("import('./BrowserRoute')");
        expect(transformed).toContain("import('./NativeRoute')");
    });

    it('preserves route helper parameters while pruning inactive direct platform branch imports', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: {
        browser: async (route) => {
            const {BrowserRoute} = await import('./BrowserRoute');
            return route.component(BrowserRoute);
        },
        reactNative: async (route) => {
            const {NativeRoute} = await import('./NativeRoute');
            return route.component(NativeRoute);
        },
    },
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'web');

        expect(transformed).toContain("import('./BrowserRoute')");
        expect(transformed).toContain('route.component');
        expect(transformed).not.toContain("import('./NativeRoute')");
    });

    it('does not prune unrelated browser and reactNative object properties', () => {
        const source = `
const unrelated = {
    component: {
        browser: () => import('./BrowserWidget'),
        reactNative: () => import('./NativeWidget'),
    },
};
`;

        expect(transformAsyncRouteComponentBranches(source, 'web')).toBe(source);
    });

    it('still prunes legacy asyncRouteComponent branches while call sites migrate', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: asyncRouteComponent({
        browser: async (route) => route.component((await import('./BrowserRoute')).BrowserRoute),
        reactNative: async (route) => route.component((await import('./NativeRoute')).NativeRoute),
    }),
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'web');

        expect(transformed).toContain("import('./BrowserRoute')");
        expect(transformed).not.toContain("import('./NativeRoute')");
    });
});

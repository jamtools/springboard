import {describe, expect, it} from 'vitest';

import {transformAsyncRouteComponentBranches} from './platform-inject';

describe('transformAsyncRouteComponentBranches', () => {
    it('removes reactNative route imports for browser builds', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: asyncRouteComponent({
        browser: () => import('./BrowserRoute').then((m) => m.BrowserRoute),
        reactNative: () => import('./NativeRoute').then((m) => m.NativeRoute),
    }),
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'web');

        expect(transformed).toContain("import('./BrowserRoute')");
        expect(transformed).not.toContain("import('./NativeRoute')");
    });

    it('removes browser route imports for React Native builds', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: asyncRouteComponent({
        browser: () => import('./BrowserRoute').then((m) => m.BrowserRoute),
        reactNative: () => import('./NativeRoute').then((m) => m.NativeRoute),
    }),
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'react-native');

        expect(transformed).not.toContain("import('./BrowserRoute')");
        expect(transformed).toContain("import('./NativeRoute')");
    });
});

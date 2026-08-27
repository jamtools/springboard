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

    it('preserves route helper parameters while pruning inactive branch imports', () => {
        const source = `
const route = defineRoute({
    path: '/shared',
    component: asyncRouteComponent({
        browser: async (route) => {
            const {BrowserRoute} = await import('./BrowserRoute');
            return route.component((props) => <BrowserRoute {...props} />);
        },
        reactNative: async (route) => {
            const {NativeRoute} = await import('./NativeRoute');
            return route.component((props) => <NativeRoute {...props} />);
        },
    }),
});
`;

        const transformed = transformAsyncRouteComponentBranches(source, 'web');

        expect(transformed).toContain("import('./BrowserRoute')");
        expect(transformed).toContain('route.component');
        expect(transformed).not.toContain("import('./NativeRoute')");
    });
});

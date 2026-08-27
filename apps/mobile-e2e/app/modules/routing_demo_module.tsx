import {springboard} from 'springboard';
import {
  defineRoute,
  defineRoutes,
} from 'springboard/router';

export const validateSongSearch = (search: Record<string, unknown>) => ({
  tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
});

export const validateWebViewItemSearch = (search: Record<string, unknown>) => ({
  source: typeof search.source === 'string' ? search.source : 'unknown',
});

declare module 'springboard/router' {
  interface RouteSearchRegistry {
    '/': Record<string, unknown>;
    '/native-static': Record<string, unknown>;
    '/songs/$songId': ReturnType<typeof validateSongSearch>;
    '/webview/$itemId': ReturnType<typeof validateWebViewItemSearch>;
  }
}

export const routingDemoRoutes = defineRoutes([
  defineRoute({
    path: '/',
    component: {
      browser: async (route) =>
        route.component((await import('./route-components/root.browser')).RootBrowserRoute),
      reactNative: async (route) =>
        route.component((await import('./route-components/root.reactNative')).RootReactNativeRoute),
    },
  }),
  defineRoute({
    path: '/native-static',
    component: {
      browser: async (route) =>
        route.component((await import('./route-components/native-static.browser')).NativeStaticBrowserRoute),
      reactNative: async (route) =>
        route.component((await import('./route-components/native-static.reactNative')).NativeStaticReactNativeRoute),
    },
  }),
  defineRoute({
    path: '/songs/$songId',
    validateSearch: validateSongSearch,
    component: {
      browser: async (route) =>
        route.component((await import('./route-components/song-detail.browser')).SongDetailBrowserRoute),
      reactNative: async (route) =>
        route.component((await import('./route-components/song-detail.reactNative')).SongDetailReactNativeRoute),
    },
  }),
  defineRoute({
    path: '/webview/$itemId',
    validateSearch: validateWebViewItemSearch,
    component: {
      browser: async (route) =>
        route.component((await import('./route-components/webview-item.browser')).WebViewItemBrowserRoute),
      reactNative: async (route) =>
        route.component((await import('./route-components/webview-item.reactNative')).WebViewItemReactNativeRoute),
    },
  }),
]);

export const mobileE2ERoutingDemoModule = springboard.defineModule(
  'MobileE2ERoutingDemo',
  {},
  async () => ({
    routes: routingDemoRoutes,
  }),
);

declare module 'springboard/register' {
  interface RegisteredModules {
    MobileE2ERoutingDemo: typeof mobileE2ERoutingDemoModule;
  }
}

import {springboard} from 'springboard';
import {
  defineRoute,
  defineRoutes,
} from 'springboard/router';

export const routingDemoRoutes = defineRoutes([
  defineRoute({
    path: '/',
    component: {
      browser: async (route) => {
        const {RootBrowserRoute} = await import('./route-components/root.browser');

        return route.component(({navigate}) => (
          <RootBrowserRoute
            onOpenStaticRoute={() => navigate({to: '/native-static'})}
            onOpenDynamicRoute={() => navigate({
              to: '/songs/$songId',
              params: {songId: 'expo-song'},
              search: {tab: 'lyrics'},
            })}
            onOpenWebViewRoute={() => navigate({
              to: '/webview/$itemId',
              params: {itemId: 'webview-demo'},
              search: {source: 'mobile-e2e'},
            })}
          />
        ));
      },
      reactNative: async (route) => {
        const {RootReactNativeRoute} = await import('./route-components/root.reactNative');

        return route.component(({navigate}) => (
          <RootReactNativeRoute
            onOpenStaticRoute={() => navigate({to: '/native-static'})}
            onOpenDynamicRoute={() => navigate({
              to: '/songs/$songId',
              params: {songId: 'expo-song'},
              search: {tab: 'lyrics'},
            })}
            onOpenWebViewRoute={() => navigate({
              to: '/webview/$itemId',
              params: {itemId: 'webview-demo'},
              search: {source: 'mobile-e2e'},
            })}
          />
        ));
      },
    },
  }),
  defineRoute({
    path: '/native-static',
    component: {
      browser: async (route) => {
        const {NativeStaticBrowserRoute} = await import('./route-components/native-static.browser');

        return route.component(() => <NativeStaticBrowserRoute />);
      },
      reactNative: async (route) => {
        const {NativeStaticReactNativeRoute} = await import('./route-components/native-static.reactNative');

        return route.component(() => <NativeStaticReactNativeRoute />);
      },
    },
  }),
  defineRoute({
    path: '/songs/$songId',
    validateSearch: (search) => ({
      tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
    }),
    component: {
      browser: async (route) => {
        const {SongDetailBrowserRoute} = await import('./route-components/song-detail.browser');

        return route.component(({params, search}) => (
          <SongDetailBrowserRoute songId={params.songId} tab={search.tab} />
        ));
      },
      reactNative: async (route) => {
        const {SongDetailReactNativeRoute} = await import('./route-components/song-detail.reactNative');

        return route.component(({params, search}) => (
          <SongDetailReactNativeRoute songId={params.songId} tab={search.tab} />
        ));
      },
    },
  }),
  defineRoute({
    path: '/webview/$itemId',
    validateSearch: (search) => ({
      source: typeof search.source === 'string' ? search.source : 'unknown',
    }),
    component: {
      browser: async (route) => {
        const {WebViewItemBrowserRoute} = await import('./route-components/webview-item.browser');

        return route.component(({params, search}) => (
          <WebViewItemBrowserRoute itemId={params.itemId} source={search.source} />
        ));
      },
      reactNative: async (route) => {
        const {WebViewItemReactNativeRoute} = await import('./route-components/webview-item.reactNative');

        return route.component(({params, search}) => (
          <WebViewItemReactNativeRoute itemId={params.itemId} source={search.source} />
        ));
      },
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

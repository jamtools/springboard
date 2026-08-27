import {springboard} from 'springboard';
import {
  asyncRouteComponent,
  defineRoute,
  defineRoutes,
} from 'springboard/router';

export const routingDemoRoutes = defineRoutes([
  defineRoute({
    path: '/',
    component: asyncRouteComponent({
      browser: async () => {
        const {RootBrowserRoute} = await import('./route-components/root.browser');
        return (props) => <RootBrowserRoute {...props} />;
      },
      reactNative: async () => {
        const {RootReactNativeRoute} = await import('./route-components/root.reactNative');
        return (props) => <RootReactNativeRoute {...props} />;
      },
    }),
  }),
  defineRoute({
    path: '/native-static',
    component: asyncRouteComponent({
      browser: async () => {
        const {NativeStaticBrowserRoute} = await import('./route-components/native-static.browser');
        return (props) => <NativeStaticBrowserRoute {...props} />;
      },
      reactNative: async () => {
        const {NativeStaticReactNativeRoute} = await import('./route-components/native-static.reactNative');
        return (props) => <NativeStaticReactNativeRoute {...props} />;
      },
    }),
  }),
  defineRoute({
    path: '/songs/$songId',
    validateSearch: (search) => ({
      tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
    }),
    component: asyncRouteComponent({
      browser: async () => {
        const {SongDetailBrowserRoute} = await import('./route-components/song-detail.browser');
        return (props) => <SongDetailBrowserRoute {...props} />;
      },
      reactNative: async () => {
        const {SongDetailReactNativeRoute} = await import('./route-components/song-detail.reactNative');
        return (props) => <SongDetailReactNativeRoute {...props} />;
      },
    }),
  }),
  defineRoute({
    path: '/webview/$itemId',
    validateSearch: (search) => ({
      source: typeof search.source === 'string' ? search.source : 'unknown',
    }),
    component: asyncRouteComponent({
      browser: async () => {
        const {WebViewItemBrowserRoute} = await import('./route-components/webview-item.browser');
        return (props) => <WebViewItemBrowserRoute {...props} />;
      },
      reactNative: async () => {
        const {WebViewItemReactNativeRoute} = await import('./route-components/webview-item.reactNative');
        return (props) => <WebViewItemReactNativeRoute {...props} />;
      },
    }),
  }),
]);

const makeMobileE2ERoutingDemoModule = async () => ({
  routes: routingDemoRoutes,
});
type MobileE2ERoutingDemoModule = Awaited<ReturnType<typeof makeMobileE2ERoutingDemoModule>>;

declare module 'springboard/core/module_registry/module_registry' {
  interface AllModules {
    MobileE2ERoutingDemo: MobileE2ERoutingDemoModule;
  }
}

export const mobileE2ERoutingDemoModule = springboard.defineModule(
  'MobileE2ERoutingDemo',
  {},
  makeMobileE2ERoutingDemoModule,
);

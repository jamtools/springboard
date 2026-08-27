import {springboard} from 'springboard';
import type {ComponentProps} from 'react';
import {
  asyncRouteComponent,
  defineRoute,
  defineRoutes,
} from 'springboard/router';
import type {SpringboardRouteProps} from 'springboard/router';

const validateSongSearch = (search: Record<string, unknown>) => ({
  tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
});

const validateWebViewItemSearch = (search: Record<string, unknown>) => ({
  source: typeof search.source === 'string' ? search.source : 'unknown',
});

export type MobileE2ERootRouteProps = SpringboardRouteProps<'/'>;
export type MobileE2ENativeStaticRouteProps = SpringboardRouteProps<'/native-static'>;
export type MobileE2ESongDetailRouteProps = SpringboardRouteProps<
  '/songs/$songId',
  ReturnType<typeof validateSongSearch>
>;
export type MobileE2EWebViewItemRouteProps = SpringboardRouteProps<
  '/webview/$itemId',
  ReturnType<typeof validateWebViewItemSearch>
>;

export const routingDemoRoutes = defineRoutes([
  defineRoute({
    path: '/',
    component: asyncRouteComponent({
      browser: async (route) => {
        const {RootBrowserRoute} = await import('./route-components/root.browser');
        return route.component((props: ComponentProps<typeof RootBrowserRoute>) => (
          <RootBrowserRoute {...props} />
        ));
      },
      reactNative: async (route) => {
        const {RootReactNativeRoute} = await import('./route-components/root.reactNative');
        return route.component((props: ComponentProps<typeof RootReactNativeRoute>) => (
          <RootReactNativeRoute {...props} />
        ));
      },
    }),
  }),
  defineRoute({
    path: '/native-static',
    component: asyncRouteComponent({
      browser: async (route) => {
        const {NativeStaticBrowserRoute} = await import('./route-components/native-static.browser');
        return route.component((props: ComponentProps<typeof NativeStaticBrowserRoute>) => (
          <NativeStaticBrowserRoute {...props} />
        ));
      },
      reactNative: async (route) => {
        const {NativeStaticReactNativeRoute} = await import('./route-components/native-static.reactNative');
        return route.component((props: ComponentProps<typeof NativeStaticReactNativeRoute>) => (
          <NativeStaticReactNativeRoute {...props} />
        ));
      },
    }),
  }),
  defineRoute({
    path: '/songs/$songId',
    validateSearch: validateSongSearch,
    component: asyncRouteComponent({
      browser: async (route) => {
        const {SongDetailBrowserRoute} = await import('./route-components/song-detail.browser');
        return route.component((props: ComponentProps<typeof SongDetailBrowserRoute>) => (
          <SongDetailBrowserRoute {...props} />
        ));
      },
      reactNative: async (route) => {
        const {SongDetailReactNativeRoute} = await import('./route-components/song-detail.reactNative');
        return route.component((props: ComponentProps<typeof SongDetailReactNativeRoute>) => (
          <SongDetailReactNativeRoute {...props} />
        ));
      },
    }),
  }),
  defineRoute({
    path: '/webview/$itemId',
    validateSearch: validateWebViewItemSearch,
    component: asyncRouteComponent({
      browser: async (route) => {
        const {WebViewItemBrowserRoute} = await import('./route-components/webview-item.browser');
        return route.component((props: ComponentProps<typeof WebViewItemBrowserRoute>) => (
          <WebViewItemBrowserRoute {...props} />
        ));
      },
      reactNative: async (route) => {
        const {WebViewItemReactNativeRoute} = await import('./route-components/webview-item.reactNative');
        return route.component((props: ComponentProps<typeof WebViewItemReactNativeRoute>) => (
          <WebViewItemReactNativeRoute {...props} />
        ));
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

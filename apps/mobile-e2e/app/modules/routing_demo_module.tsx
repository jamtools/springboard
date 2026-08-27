import React from 'react';
import {Button, Text, View} from 'react-native';

import {springboard} from 'springboard';
import {
  asyncRouteComponent,
  defineRoute,
  defineRouteComponent,
  defineRoutes,
  useNavigate,
} from 'springboard/router';

const MobileE2ERootRoute = () => {
  const navigate = useNavigate();

  return (
    <View testID="springboard-routing-root">
      <Text>Springboard routing root</Text>
      <Button title="Open static route" onPress={() => navigate({to: '/native-static'})} />
      <Button
        title="Open dynamic route"
        onPress={() => navigate({
          to: '/songs/$songId',
          params: {songId: 'expo-song'},
          search: {tab: 'lyrics'},
        })}
      />
      <Button
        title="Open WebView route"
        onPress={() => navigate({
          to: '/webview/$itemId',
          params: {itemId: 'webview-demo'},
          search: {source: 'mobile-e2e'},
        })}
      />
    </View>
  );
};

const MobileE2EStaticRoute = () => (
  <View testID="springboard-routing-static">
    <Text>Springboard static native route</Text>
  </View>
);

type MobileE2ESongSearch = {
  tab: 'lyrics' | 'overview';
};

const MobileE2EDynamicRoute = defineRouteComponent<'/songs/$songId', MobileE2ESongSearch>(({params, search}) => (
    <View testID="springboard-routing-dynamic">
      <Text testID="springboard-routing-song-id">{params.songId}</Text>
      <Text testID="springboard-routing-song-tab">{search.tab}</Text>
    </View>
));

const BrowserWebViewOnlyRoute = () => (
  <View>
    <Text>Browser WebView route</Text>
  </View>
);

export const routingDemoRoutes = defineRoutes([
  defineRoute({
    path: '/',
    component: MobileE2ERootRoute,
  }),
  defineRoute({
    path: '/native-static',
    component: MobileE2EStaticRoute,
  }),
  defineRoute({
    path: '/songs/$songId',
    component: MobileE2EDynamicRoute,
    validateSearch: (search) => ({
      tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
    }),
  }),
  defineRoute({
    path: '/webview/$itemId',
    component: asyncRouteComponent({
      browser: async () => BrowserWebViewOnlyRoute,
    }),
    validateSearch: (search) => ({
      source: typeof search.source === 'string' ? search.source : 'unknown',
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

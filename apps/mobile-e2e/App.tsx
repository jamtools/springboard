import React, { useMemo, useRef, useState } from 'react';
import { Button, StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Springboard } from 'springboard/core/engine/engine';
import { SpringboardProviderPure } from 'springboard/core/engine/engine';
import { SpringboardExpoWebViewHost } from 'springboard/platforms/react-native/components/expo_springboard_webview_host';
import { SpringboardReactNavigationHost, SpringboardWebViewTarget } from 'springboard/platforms/react-native/components/routing';
import { asyncRouteComponent, defineRoute, defineRoutes, useNavigate, useParams, useSearch } from 'springboard/router';

void SplashScreen.preventAutoHideAsync();

const MobileE2ERootRoute = () => {
  const navigate = useNavigate();

  return (
    <View testID="springboard-routing-root">
      <Text>Springboard routing root</Text>
      <Button title="Open static route" onPress={() => navigate({ to: '/native-static' })} />
      <Button
        title="Open dynamic route"
        onPress={() => navigate({
          to: '/songs/$songId',
          params: { songId: 'expo-song' },
          search: { tab: 'lyrics' },
        })}
      />
      <Button
        title="Open WebView route"
        onPress={() => navigate({
          to: '/webview/$itemId',
          params: { itemId: 'webview-demo' },
          search: { source: 'mobile-e2e' },
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

const MobileE2EDynamicRoute = () => {
  const params = useParams({ from: '/songs/$songId' });
  const search = useSearch({ from: '/songs/$songId' }) as { tab: string };

  return (
    <View testID="springboard-routing-dynamic">
      <Text testID="springboard-routing-song-id">{params.songId}</Text>
      <Text testID="springboard-routing-song-tab">{search.tab}</Text>
    </View>
  );
};

const BrowserWebViewOnlyRoute = () => (
  <View>
    <Text>Browser WebView route</Text>
  </View>
);

const routingDemoRoutes = defineRoutes([
  defineRoute({ path: '/', component: MobileE2ERootRoute }),
  defineRoute({ path: '/native-static', component: MobileE2EStaticRoute }),
  defineRoute({
    path: '/songs/$songId',
    component: MobileE2EDynamicRoute,
    validateSearch: (search) => ({
      tab: search.tab === 'lyrics' ? 'lyrics' : 'overview',
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

export default function App() {
  const onMessageFromRN = useRef<((message: string) => void) | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const extra = Constants.expoConfig?.extra as {
    mode?: string;
    scheme?: string;
    siteUrl?: string;
    loadFromSiteUrl?: boolean;
  } | undefined;
  const engine = useMemo(() => ({
    moduleRegistry: {
      getModules: () => [{
        moduleId: 'MobileE2ERoutingDemo',
        routes: routingDemoRoutes,
      }],
      useModules: () => [{
        moduleId: 'MobileE2ERoutingDemo',
        routes: routingDemoRoutes,
      }],
    },
  }) as unknown as Springboard, []);

  const loadedTestId = extra?.loadFromSiteUrl === true
    ? 'springboard-mobile-remote-server'
    : 'springboard-mobile-local-assets';
  const loadedText = extra?.loadFromSiteUrl === true
    ? 'Springboard remote server loaded'
    : 'Springboard local assets loaded';
  const expectedReadyMessageType = extra?.loadFromSiteUrl === true
    ? 'springboard-mobile-e2e-remote-server-ready'
    : 'springboard-mobile-e2e-local-assets-ready';
  const webViewTarget: SpringboardWebViewTarget = extra?.loadFromSiteUrl === true
    ? { kind: 'remote', url: `${extra?.siteUrl || 'http://10.0.2.2:1337'}/webview-route` }
    : { kind: 'local', uri: 'file:///springboard-mobile-e2e/assets/web/index.html' };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <View style={styles.container}>
          <SpringboardProviderPure engine={engine}>
            <SpringboardReactNavigationHost
              linkingPrefixes={[`${extra?.scheme || 'springboardmobilee2elocalassets'}://`]}
              resolveWebViewTarget={async () => webViewTarget}
              renderWebViewTarget={(target) => (
                <SpringboardExpoWebViewHost
                  engine={engine}
                  siteUrl={target.kind === 'remote' ? target.url : extra?.siteUrl || 'http://10.0.2.2:1337'}
                  loadFromSiteUrl={target.kind === 'remote'}
                  assetModules={{
                    html: require('./assets/web/index.html'),
                    css: require('./assets/web/index-css.css'),
                    js: require('./assets/web/index-js.js.asset'),
                  }}
                  handleMessageFromWebview={(message) => {
                    console.log('Message from WebView:', message);
                    try {
                      const parsed = JSON.parse(message) as { type?: string };
                      if (parsed.type === expectedReadyMessageType) {
                        setWebViewLoaded(true);
                      }
                    } catch {
                      // Ignore non-JSON messages from application code.
                    }
                  }}
                  onMessageFromRN={(cb) => {
                    onMessageFromRN.current = cb;
                  }}
                  hideSplashScreen={SplashScreen.hideAsync}
                  splashHideDelayMs={0}
                  onWebViewError={(error) => {
                    console.warn('Springboard mobile fixture WebView error:', error);
                  }}
                />
              )}
            />
          </SpringboardProviderPure>
          {/* Keep the legacy host mounted for the existing mobile fixture readiness checks. */}
          <View style={styles.legacyWebViewHost}>
            <SpringboardExpoWebViewHost
            engine={engine}
            siteUrl={extra?.siteUrl || 'http://10.0.2.2:1337'}
            loadFromSiteUrl={extra?.loadFromSiteUrl === true}
            assetModules={{
              html: require('./assets/web/index.html'),
              css: require('./assets/web/index-css.css'),
              js: require('./assets/web/index-js.js.asset'),
            }}
            handleMessageFromWebview={(message) => {
              console.log('Message from WebView:', message);
              try {
                const parsed = JSON.parse(message) as { type?: string };
                if (parsed.type === expectedReadyMessageType) {
                  setWebViewLoaded(true);
                }
              } catch {
                // Ignore non-JSON messages from application code.
              }
            }}
            onMessageFromRN={(cb) => {
              onMessageFromRN.current = cb;
            }}
            hideSplashScreen={SplashScreen.hideAsync}
            splashHideDelayMs={0}
            onWebViewError={(error) => {
              console.warn('Springboard mobile fixture WebView error:', error);
            }}
            />
          </View>
          {webViewLoaded ? (
            <Text
              accessible
              accessibilityLabel={loadedTestId}
              testID={loadedTestId}
              style={styles.loadedStatus}
            >
              {loadedText}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  legacyWebViewHost: {
    height: 1,
    opacity: 0,
    width: 1,
  },
  loadedStatus: {
    backgroundColor: 'transparent',
    color: '#000',
    fontSize: 1,
    left: 0,
    position: 'absolute',
    top: 0,
  },
});

import React, { useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SpringboardProviderPure } from 'springboard/core/engine/engine';
import { NullKVStore } from 'springboard/core/services/namespaced_kv_store';
import type { Rpc } from 'springboard/core/types/module_types';
import { SpringboardExpoWebViewHost } from 'springboard/platforms/react-native/components/expo_springboard_webview_host';
import { SpringboardReactNavigationHost, SpringboardWebViewTarget } from 'springboard/platforms/react-native/components/routing';
import {
  useAndInitializeSpringboardEngine,
} from 'springboard/platforms/react-native/entrypoints/rn_app_springboard_entrypoint';

import initializeRNSpringboardEngine from './app/entrypoints/rn_init_module';

void SplashScreen.preventAutoHideAsync();

const inMemoryAsyncStorage = (() => {
  const values = new Map<string, string>();

  return {
    getAllKeys: async (): Promise<readonly string[]> => [...values.keys()],
    getItem: async (key: string): Promise<string | null> => values.get(key) ?? null,
    setItem: async (key: string, value: string): Promise<void> => {
      values.set(key, value);
    },
  };
})();

const mobileE2ERemoteRpc: Rpc = {
  role: 'client',
  callRpc: async <Args, Return>() => null as Return,
  broadcastRpc: async () => undefined,
  registerRpc: () => undefined,
  initialize: async () => true,
};

export default function App() {
  const onMessageFromRN = useRef<((message: string) => void) | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const extra = Constants.expoConfig?.extra as {
    mode?: string;
    scheme?: string;
    siteUrl?: string;
    loadFromSiteUrl?: boolean;
  } | undefined;
  const springboardInit = useAndInitializeSpringboardEngine({
    applicationEntrypoint: initializeRNSpringboardEngine,
    asyncStorageDependency: inMemoryAsyncStorage,
    onMessageFromRN: (message) => onMessageFromRN.current?.(message),
    remoteKv: new NullKVStore(),
    remoteRpc: mobileE2ERemoteRpc,
  });

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

  if (!springboardInit) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar hidden />
          <View style={styles.loadingContainer}>
            <Text testID="springboard-mobile-initializing">Initializing Springboard mobile app</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const {engine, handleMessageFromWebview} = springboardInit;
  const handleSpringboardWebViewMessage = (message: string) => {
    handleMessageFromWebview(message);
    console.log('Message from WebView:', message);
    try {
      const parsed = JSON.parse(message) as { type?: string };
      if (parsed.type === expectedReadyMessageType) {
        setWebViewLoaded(true);
      }
    } catch {
      // Ignore non-JSON messages from application code.
    }
  };

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
                    css: require('./assets/web/index-css.css.asset'),
                    js: require('./assets/web/index-js.js.asset'),
                  }}
                  handleMessageFromWebview={handleSpringboardWebViewMessage}
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
              css: require('./assets/web/index-css.css.asset'),
              js: require('./assets/web/index-js.js.asset'),
            }}
            handleMessageFromWebview={handleSpringboardWebViewMessage}
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
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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

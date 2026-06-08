import React, { useMemo, useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Springboard } from 'springboard/core/engine/engine';
import { SpringboardExpoWebViewHost } from 'springboard/platforms/react-native/components/expo_springboard_webview_host';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const onMessageFromRN = useRef<((message: string) => void) | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const engine = useMemo(() => ({} as Springboard), []);
  const extra = Constants.expoConfig?.extra as {
    mode?: string;
    siteUrl?: string;
    loadFromSiteUrl?: boolean;
  } | undefined;

  const loadedTestId = extra?.loadFromSiteUrl === true
    ? 'springboard-mobile-remote-server'
    : 'springboard-mobile-local-assets';
  const loadedText = extra?.loadFromSiteUrl === true
    ? 'Springboard remote server loaded'
    : 'Springboard local assets loaded';
  const expectedReadyMessageType = extra?.loadFromSiteUrl === true
    ? 'springboard-mobile-e2e-remote-server-ready'
    : 'springboard-mobile-e2e-local-assets-ready';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <View style={styles.container}>
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
  loadedStatus: {
    backgroundColor: 'transparent',
    color: 'transparent',
    fontSize: 1,
    left: 0,
    position: 'absolute',
    top: 0,
  },
});

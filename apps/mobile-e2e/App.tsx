import React, { useMemo, useRef } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Springboard } from 'springboard/core/engine/engine';
import { SpringboardExpoWebViewHost } from 'springboard/platforms/react-native/entrypoints/rn_app_springboard_entrypoint';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const onMessageFromRN = useRef<((message: string) => void) | null>(null);
  const engine = useMemo(() => ({} as Springboard), []);
  const extra = Constants.expoConfig?.extra as {
    mode?: string;
    siteUrl?: string;
    loadFromSiteUrl?: boolean;
  } | undefined;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

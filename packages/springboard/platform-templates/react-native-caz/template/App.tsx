import React, {useRef, useState} from 'react';
import {StyleSheet, StatusBar} from 'react-native';

import {MainWebview} from '@springboardjs/platforms-react-native/components/main_webview';

import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {SpringboardProviderPure} from 'springboard/engine/engine';

// Conditionally import custom packages if available<% if (customRnMainPackage) { %>
import {handleOnShouldStartLoadWithRequest, initRnMainHooks, RnMainProviders} from '<%= customRnMainPackage %>/src/hooks/rn_main_init_hooks';<% } %>


import {useAndInitializeSpringboardEngine} from '@springboardjs/platforms-react-native/entrypoints/rn_app_springboard_entrypoint';

import initializeRNSpringboardEngine from './app/entrypoints/rn_init_module';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';
import {BrowserJsonRpcClientAndServer} from '@springboardjs/platforms-browser/services/browser_json_rpc';
import {HttpKVStoreService} from 'springboard/services/http_kv_store_client';

const DATA_HOST: string = process.env.EXPO_PUBLIC_SITE_URL || '';
const WS_HOST = DATA_HOST.replace('http', 'ws');

let WS_FULL_URL = WS_HOST + '/ws';
// if (queryParams) {
//     WS_FULL_URL += `?${queryParams.toString()}`;
// }

const remoteRpc = new BrowserJsonRpcClientAndServer(WS_FULL_URL);
const remoteKv = new HttpKVStoreService(DATA_HOST);

export default function App() {
  const [spaRoute, setSpaRoute] = useState<{route: string} | null>(null);
  const onMessageFromRN = useRef<((message: string) => void) | null>(null);

  const sbInitResult = useAndInitializeSpringboardEngine({
    applicationEntrypoint: initializeRNSpringboardEngine,
    asyncStorageDependency: AsyncStorage,
    onMessageFromRN: (message) => {
      onMessageFromRN.current?.(message);
    },
    remoteKv,
    remoteRpc,
  });

<% if (customRnMainPackage) { %>  // Initialize custom RN main hooks if available
  initRnMainHooks({
    setSpaRoute,
    engine: sbInitResult?.engine,
  });

  const customHandleOnShouldStartLoadWithRequest = (request: any) => {
    return handleOnShouldStartLoadWithRequest(request, sbInitResult?.engine!);
  };<% } else { %>  const genericHandleOnShouldStartLoadWithRequest = (request: any) => {
    // Generic handler for webview navigation requests
    const url = request.url;
    
    // Allow standard protocols
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    // Block other protocols for security
    return false;
  };<% } %>

  let content: React.ReactNode = sbInitResult?.engine && sbInitResult?.handleMessageFromWebview && (
    <MainWebview
      spaRoute={spaRoute}
      engine={sbInitResult.engine}
      handleMessageFromWebview={sbInitResult.handleMessageFromWebview}
      onMessageFromRN={cb => {
        onMessageFromRN.current = cb;
      }}
      onShouldStartLoadWithRequest={<% if (customRnMainPackage) { %>customHandleOnShouldStartLoadWithRequest<% } else { %>genericHandleOnShouldStartLoadWithRequest<% } %>}
      webAppUrl={DATA_HOST}
      showNavigation={true}
    />
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        {sbInitResult?.engine && (
          <SpringboardProviderPure
            engine={sbInitResult.engine}
          ><% if (customRnMainPackage) { %>
            <RnMainProviders>
              {content}
            </RnMainProviders><% } else { %>
            {content}<% } %>
          </SpringboardProviderPure>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

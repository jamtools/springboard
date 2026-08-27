import React from 'react';
import {Button, Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const RootBrowserRoute = defineRouteComponent<'/'>(({navigate}) => (
  <View testID="springboard-routing-root-browser">
    <Text>Springboard routing root browser</Text>
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
));

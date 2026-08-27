import React from 'react';
import {Button, Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const RootReactNativeRoute = defineRouteComponent<'/'>(({navigate}) => (
  <View accessibilityLabel="springboard-routing-root" testID="springboard-routing-root">
    <Text accessibilityLabel="springboard-routing-root-content">Springboard routing root</Text>
    <Button
      accessibilityLabel="springboard-routing-open-static"
      title="Open static route"
      onPress={() => navigate({to: '/native-static'})}
    />
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

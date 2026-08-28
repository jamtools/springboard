import React from 'react';
import {Button, Text, View} from 'react-native';

type RootReactNativeRouteProps = {
  onOpenStaticRoute: () => void;
  onOpenDynamicRoute: () => void;
  onOpenWebViewRoute: () => void;
};

export const RootReactNativeRoute = (props: RootReactNativeRouteProps) => (
  <View accessibilityLabel="springboard-routing-root" testID="springboard-routing-root">
    <Text accessibilityLabel="springboard-routing-root-content">Springboard routing root</Text>
    <Button
      accessibilityLabel="springboard-routing-open-static"
      title="Open static route"
      onPress={props.onOpenStaticRoute}
    />
    <Button
      title="Open dynamic route"
      onPress={props.onOpenDynamicRoute}
    />
    <Button
      title="Open WebView route"
      onPress={props.onOpenWebViewRoute}
    />
  </View>
);

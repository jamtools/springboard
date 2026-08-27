import React from 'react';
import {Button, Text, View} from 'react-native';

type RootBrowserRouteProps = {
  onOpenStaticRoute: () => void;
  onOpenDynamicRoute: () => void;
  onOpenWebViewRoute: () => void;
};

export const RootBrowserRoute = (props: RootBrowserRouteProps) => (
  <View testID="springboard-routing-root-browser">
    <Text>Springboard routing root browser</Text>
    <Button title="Open static route" onPress={props.onOpenStaticRoute} />
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

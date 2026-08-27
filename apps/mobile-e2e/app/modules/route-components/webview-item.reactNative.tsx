import React from 'react';
import {Text, View} from 'react-native';

type WebViewItemReactNativeRouteProps = {
  itemId: string;
  source: string;
};

export const WebViewItemReactNativeRoute = (props: WebViewItemReactNativeRouteProps) => (
  <View testID="springboard-routing-webview-native">
    <Text>{props.itemId}</Text>
    <Text>{props.source}</Text>
  </View>
);

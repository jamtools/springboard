import React from 'react';
import {Text, View} from 'react-native';

type WebViewItemBrowserRouteProps = {
  itemId: string;
  source: string;
};

export const WebViewItemBrowserRoute = (props: WebViewItemBrowserRouteProps) => (
  <View testID="springboard-routing-webview-browser">
    <Text>{props.itemId}</Text>
    <Text>{props.source}</Text>
  </View>
);

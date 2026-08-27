import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const WebViewItemReactNativeRoute = defineRouteComponent<'/webview/$itemId'>(({params, search}) => (
  <View testID="springboard-routing-webview-native">
    <Text>{params.itemId}</Text>
    <Text>{search.source}</Text>
  </View>
));

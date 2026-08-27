import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const WebViewItemBrowserRoute = defineRouteComponent<'/webview/$itemId'>(({params, search}) => (
  <View testID="springboard-routing-webview-browser">
    <Text>{params.itemId}</Text>
    <Text>{search.source}</Text>
  </View>
));

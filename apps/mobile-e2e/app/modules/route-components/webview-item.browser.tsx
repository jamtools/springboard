import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {validateWebViewItemSearch} from '../routing_demo_module';

export const WebViewItemBrowserRoute = defineRouteComponent<
  '/webview/$itemId',
  ReturnType<typeof validateWebViewItemSearch>
>(({params, search}) => (
  <View testID="springboard-routing-webview-browser">
    <Text>{params.itemId}</Text>
    <Text>{search.source}</Text>
  </View>
));

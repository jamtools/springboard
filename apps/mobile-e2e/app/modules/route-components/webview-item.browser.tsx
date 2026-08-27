import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {MobileE2EWebViewItemRouteProps} from '../routing_demo_module';

export const WebViewItemBrowserRoute = defineRouteComponent(({params, search}: MobileE2EWebViewItemRouteProps) => (
  <View testID="springboard-routing-webview-browser">
    <Text>{params.itemId}</Text>
    <Text>{search.source}</Text>
  </View>
));

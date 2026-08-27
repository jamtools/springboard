import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const NativeStaticBrowserRoute = defineRouteComponent('/native-static', () => (
  <View testID="springboard-routing-static-browser">
    <Text>Springboard static browser route</Text>
  </View>
));

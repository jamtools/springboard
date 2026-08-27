import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const NativeStaticReactNativeRoute = defineRouteComponent('/native-static', () => (
  <View accessibilityLabel="springboard-routing-static" testID="springboard-routing-static">
    <Text accessibilityLabel="springboard-routing-static-content">
      Springboard static native route
    </Text>
  </View>
));

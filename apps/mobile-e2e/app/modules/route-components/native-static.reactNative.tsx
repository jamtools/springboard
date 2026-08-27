import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const NativeStaticReactNativeRoute = defineRouteComponent<'/native-static'>(() => (
  <View testID="springboard-routing-static">
    <Text>Springboard static native route</Text>
  </View>
));

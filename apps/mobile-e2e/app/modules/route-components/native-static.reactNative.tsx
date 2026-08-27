import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {MobileE2ENativeStaticRouteProps} from '../routing_demo_module';

export const NativeStaticReactNativeRoute = defineRouteComponent((props: MobileE2ENativeStaticRouteProps) => (
  <View testID="springboard-routing-static">
    <Text>Springboard static native route</Text>
  </View>
));

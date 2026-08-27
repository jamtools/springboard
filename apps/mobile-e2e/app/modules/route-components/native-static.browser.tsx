import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {MobileE2ENativeStaticRouteProps} from '../routing_demo_module';

export const NativeStaticBrowserRoute = defineRouteComponent((props: MobileE2ENativeStaticRouteProps) => (
  <View testID="springboard-routing-static-browser">
    <Text>Springboard static browser route</Text>
  </View>
));

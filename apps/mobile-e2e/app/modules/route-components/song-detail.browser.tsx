import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {MobileE2ESongDetailRouteProps} from '../routing_demo_module';

export const SongDetailBrowserRoute = defineRouteComponent(({params, search}: MobileE2ESongDetailRouteProps) => (
  <View testID="springboard-routing-dynamic-browser">
    <Text testID="springboard-routing-song-id-browser">{params.songId}</Text>
    <Text testID="springboard-routing-song-tab-browser">{search.tab}</Text>
  </View>
));

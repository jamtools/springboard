import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';
import type {validateSongSearch} from '../routing_demo_module';

export const SongDetailReactNativeRoute = defineRouteComponent<
  '/songs/$songId',
  ReturnType<typeof validateSongSearch>
>(({params, search}) => (
  <View testID="springboard-routing-dynamic">
    <Text testID="springboard-routing-song-id">{params.songId}</Text>
    <Text testID="springboard-routing-song-tab">{search.tab}</Text>
  </View>
));

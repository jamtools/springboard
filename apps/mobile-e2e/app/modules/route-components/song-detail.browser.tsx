import React from 'react';
import {Text, View} from 'react-native';

import {defineRouteComponent} from 'springboard/router';

export const SongDetailBrowserRoute = defineRouteComponent<'/songs/$songId'>(({params, search}) => (
  <View testID="springboard-routing-dynamic-browser">
    <Text testID="springboard-routing-song-id-browser">{params.songId}</Text>
    <Text testID="springboard-routing-song-tab-browser">{search.tab}</Text>
  </View>
));

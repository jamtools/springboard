import React from 'react';
import {Text, View} from 'react-native';

type SongDetailBrowserRouteProps = {
  songId: string;
  tab: 'lyrics' | 'overview';
};

export const SongDetailBrowserRoute = (props: SongDetailBrowserRouteProps) => (
  <View testID="springboard-routing-dynamic-browser">
    <Text testID="springboard-routing-song-id-browser">{props.songId}</Text>
    <Text testID="springboard-routing-song-tab-browser">{props.tab}</Text>
  </View>
);

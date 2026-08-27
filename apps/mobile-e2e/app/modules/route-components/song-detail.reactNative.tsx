import React from 'react';
import {Text, View} from 'react-native';

type SongDetailReactNativeRouteProps = {
  songId: string;
  tab: 'lyrics' | 'overview';
};

export const SongDetailReactNativeRoute = (props: SongDetailReactNativeRouteProps) => (
  <View testID="springboard-routing-dynamic">
    <Text testID="springboard-routing-song-id">{props.songId}</Text>
    <Text testID="springboard-routing-song-tab">{props.tab}</Text>
  </View>
);

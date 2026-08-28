import type { ExpoConfig } from 'expo/config';

const mode = process.env.EXPO_MOBILE_E2E_MODE || 'local-assets';
const siteUrl = process.env.EXPO_PUBLIC_SITE_URL || 'http://10.0.2.2:1337';
const loadFromSiteUrl = mode === 'remote-server';
const nativeSuffix = mode.replace(/[^A-Za-z0-9_]/g, '');
const scheme = `springboardmobilee2e${nativeSuffix}`;

const config: ExpoConfig = {
  name: `Springboard Mobile E2E ${mode}`,
  slug: 'springboard-mobile-e2e',
  scheme,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  android: {
    package: `com.jamtools.springboard.mobilee2e.${nativeSuffix}`,
  },
  ios: {
    bundleIdentifier: `com.jamtools.springboard.mobilee2e.${nativeSuffix}`,
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: loadFromSiteUrl ? ['./plugins/with-cleartext-traffic.cjs'] : [],
  extra: {
    mode,
    scheme,
    siteUrl,
    loadFromSiteUrl,
  },
};

if (process.env.EXPO_GITHUB_ACTIONS_RUN) {
  config.runtimeVersion = '1.0.0';
}

export default config;

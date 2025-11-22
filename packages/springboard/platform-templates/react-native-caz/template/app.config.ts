import {ExpoConfig, ConfigContext} from 'expo/config';

const appProfile = (process.env as Record<string, string | undefined>).EXPO_APP_PROFILE || 'development';
const appQualifier = appProfile.includes('production') ? '' : appProfile;

const appQualifierWithDash = appQualifier ? (appQualifier + '-') : '';
const appQualifierWithDot = appQualifier ? ('.' + appQualifier) : '';

const env = (process.env as Record<string, string | undefined>);

// const appQualifierWithDash = appProfile === 'production' ? '' : '-' + appProfile;
// const appQualifierWithDot = appProfile === 'production' ? '' : '.' + appProfile;

const version = '0.1.0';

const ids = {
  "title": "<%= title %>",
  "slug": "<%= slug %>",
  "dot": "<%= dot %>",
  "flat": "<%= flat %>"
};

export default ({config}: ConfigContext): ExpoConfig => ({
  "name": `${appQualifierWithDash}${ids.title}`,
  "scheme": `${ids.flat}${appQualifier}`,
  "userInterfaceStyle": "automatic",
  "slug": ids.slug,
  "version": version,
  "orientation": "portrait",
  "splash": {
    "image": "./assets/icon-android-foreground.png",
    "resizeMode": "contain",
    "backgroundColor": "#2D2C80"
  },
  "updates": {
    "fallbackToCacheTimeout": 0
  },
  "assetBundlePatterns": [
    "**/*"
  ],
  "ios": {
    "bundleIdentifier": `${ids.dot}${appQualifierWithDot}`,
    "buildNumber": version,
    "supportsTablet": true,
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false
    },
    "icon": "./assets/icon-ios.png",
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/icon-android-foreground.png",
      "backgroundImage": "./assets/icon-android-background.png"
    },
    "icon": "./assets/icon.png",
    "package": `${ids.dot}${appQualifierWithDot}`,
    ...(
      !env.EXPO_GITHUB_ACTIONS_RUN ? {
        "googleServicesFile": env.GOOGLE_SERVICES_JSON || env.EXPO_GOOGLE_SERVICES_FILE,
      } : {

      }
    ),
    "permissions": [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
    ]
  },
  "web": {
    "favicon": "./assets/favicon.png"
  },
  "extra": {
    "eas": {
      "build": {
        "experimental": {
          "ios": {
            "appExtensions": []
          }
        }
      }
    }
  },
  "plugins": [
    "expo-document-picker",
    [
      "expo-share-intent",
      {
        "iosActivationRules": {
          "NSExtensionActivationSupportsWebURLWithMaxCount": 10,
          "NSExtensionActivationSupportsWebPageWithMaxCount": 10,
          "NSExtensionActivationSupportsImageWithMaxCount": 10,
          "NSExtensionActivationSupportsMovieWithMaxCount": 10,
          "NSExtensionActivationSupportsText": true,
          "NSExtensionActivationSupportsFileWithMaxCount": 10
        },
        "androidIntentFilters": [
          "*/*"
        ],
        "androidMultiIntentFilters": [
          "*/*"
        ]
      }
    ],
  ],
  "runtimeVersion": {
    "policy": "appVersion"
  }
});

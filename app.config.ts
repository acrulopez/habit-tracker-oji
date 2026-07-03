import { ExpoConfig, ConfigContext } from "expo/config";

// Keep in sync with src/config.ts (runtime reads this via expo-constants `extra`).
const BUNDLE_ID = "dev.alejandrodelacruz.habittracker";
const APP_GROUP = `group.${BUNDLE_ID}`;
// Apple Developer Team ID — required for iOS widget (App Group) builds.
// Single source of truth is eas.json (build.production.env.APPLE_TEAM_ID), so
// EAS cloud builds and local `expo run:ios` agree. An APPLE_TEAM_ID env var
// still wins if set, letting you override per-build without editing files.
const easTeamId = (() => {
  try {
    // Read directly so a broken/absent eas.json degrades to undefined instead
    // of failing config evaluation.
    return require("./eas.json")?.build?.production?.env?.APPLE_TEAM_ID as
      | string
      | undefined;
  } catch {
    return undefined;
  }
})();
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? easTeamId ?? undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Habit Tracker Oji",
  slug: "habit-tracker-oji",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "habittracker",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    appleTeamId: APPLE_TEAM_ID,
    entitlements: {
      "com.apple.security.application-groups": [APP_GROUP],
    },
    infoPlist: {
      // react-native-mmkv uses this App Group dir on iOS so the widget can read it.
      AppGroup: APP_GROUP,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: "#0E0E10",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "17.0" },
      },
    ],
    [
      "@bacons/apple-targets",
      {
        appleTeamId: APPLE_TEAM_ID,
      },
    ],
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "Habits",
            label: "Habit Tracker Oji",
            description: "Tap to complete today's habits",
            minWidth: "180dp",
            minHeight: "180dp",
            targetCellWidth: 4,
            targetCellHeight: 3,
            resizeMode: "horizontal|vertical",
            // ~30 min (Android's minimum) so the day cells roll over even if the
            // app isn't opened; the app also pushes updates on every change.
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  extra: {
    appGroup: APP_GROUP,
    bundleId: BUNDLE_ID,
  },
});

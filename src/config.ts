import Constants from "expo-constants";

// Mirrors the values defined in app.config.ts. We read them from `extra` at
// runtime, with a hardcoded fallback so non-Expo contexts (e.g. unit tests)
// still resolve a sane value.
const FALLBACK_BUNDLE_ID = "dev.alejandrodelacruz.habittracker";

export const BUNDLE_ID: string =
  (Constants.expoConfig?.extra?.bundleId as string | undefined) ??
  FALLBACK_BUNDLE_ID;

export const APP_GROUP: string =
  (Constants.expoConfig?.extra?.appGroup as string | undefined) ??
  `group.${FALLBACK_BUNDLE_ID}`;

// Must match the iOS widget `kind` (targets/widget/index.swift) and the Android
// widget `name` (app.config.ts react-native-android-widget plugin config).
export const IOS_WIDGET_KIND = "HabitsWidget";
// Second iOS-only widget: a small (2×2) "3-day strip" variant. Matches the Swift
// `kind` in targets/widget/index.swift.
export const IOS_WIDGET_KIND_HISTORY = "HabitsHistory";
export const ANDROID_WIDGET_NAME = "Habits";

// Keys shared with the native iOS widget through the App Group UserDefaults.
export const SNAPSHOT_KEY = "todaySnapshot";
export const PENDING_TOGGLES_KEY = "pendingToggles";

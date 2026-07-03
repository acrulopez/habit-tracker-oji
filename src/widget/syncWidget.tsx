import React from "react";
import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import {
  ANDROID_WIDGET_NAME,
  APP_GROUP,
  IOS_WIDGET_KIND,
  SNAPSHOT_KEY,
} from "../config";
import { buildTodaySnapshot } from "./snapshot";
import { HabitsWidget } from "./HabitsWidget";
import { deriveLayout, getWidgetSize } from "./widgetLayout";

/**
 * Push the current "today" state to the home-screen widget(s).
 * Call this after every mutation that can change today's completion state.
 *
 * - iOS: write a JSON snapshot into the App Group UserDefaults and reload the
 *   WidgetKit timeline (the SwiftUI widget reads this snapshot).
 * - Android: re-render the widget with fresh data.
 */
export function syncWidget(): void {
  const snapshot = buildTodaySnapshot();

  if (Platform.OS === "ios") {
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget(IOS_WIDGET_KIND);
    return;
  }

  if (Platform.OS === "android") {
    // Lazy require keeps this Android-only call out of the iOS evaluation path.
    const { requestWidgetUpdate } = require("react-native-android-widget");
    const layout = deriveLayout(getWidgetSize());
    requestWidgetUpdate({
      widgetName: ANDROID_WIDGET_NAME,
      renderWidget: () => (
        <HabitsWidget
          snapshot={snapshot}
          todayOnly={layout.todayOnly}
          maxRows={layout.maxRows}
        />
      ),
      widgetNotFound: () => {},
    });
  }
}

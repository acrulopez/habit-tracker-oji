import "react-native-gesture-handler";
import { Platform } from "react-native";

// Register the Android home-screen widget background task BEFORE the app boots,
// so taps on the widget (which run headless JS) are handled even when the app is closed.
if (Platform.OS === "android") {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  const { widgetTaskHandler } = require("./src/widget/widgetTaskHandler");
  registerWidgetTaskHandler(widgetTaskHandler);
}

// Expo Router owns the root component / navigation tree.
import "expo-router/entry";

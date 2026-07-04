import { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useHabitStore } from "../src/store/useHabitStore";
import * as cloudBackup from "../src/data/cloudBackup";
import { useTheme } from "../src/theme/theme";

export default function RootLayout() {
  const refresh = useHabitStore((s) => s.refresh);
  const theme = useTheme();

  useEffect(() => {
    refresh();
    // Restore from iCloud only after the first refresh() has drained pending
    // widget toggles, so local taps are never clobbered. Runs once per launch.
    if (cloudBackup.restoreOnLaunch()) refresh();
    // Pull newer data pushed from another device (iPhone/iPad on one account).
    const unsubscribe = cloudBackup.registerCloudListener(() => refresh());
    const sub = AppState.addEventListener("change", (state) => {
      // On returning to the app, drain any widget toggles and reload state.
      if (state === "active") refresh();
      // Flush any pending backup before we lose foreground time.
      else if (state === "background") cloudBackup.flushPendingUpload();
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, [refresh]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="habit/[id]/edit"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="habit/[id]/history" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/reorder" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

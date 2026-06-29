import { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useHabitStore } from "../src/store/useHabitStore";
import { useTheme } from "../src/theme/theme";

export default function RootLayout() {
  const refresh = useHabitStore((s) => s.refresh);
  const theme = useTheme();

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      // On returning to the app, drain any widget toggles and reload state.
      if (state === "active") refresh();
    });
    return () => sub.remove();
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

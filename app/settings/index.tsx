import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useHabitStore } from "../../src/store/useHabitStore";
import { useTheme } from "../../src/theme/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const habitCount = useHabitStore((s) => s.habits.length);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Section title="Habits">
          <Row
            icon="swap-vertical"
            label="Reorder habits"
            detail={habitCount < 2 ? "Add a few habits first" : undefined}
            disabled={habitCount < 2}
            onPress={() => router.push("/settings/reorder")}
          />
        </Section>

        <Section title="Appearance">
          <Row
            icon="contrast-outline"
            label="Theme"
            detail="Automatic (follows system)"
          />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" label="Habit Tracker Oji" detail={`v${Constants.expoConfig?.version ?? "1.0.0"}`} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: theme.subtext }]}>{title}</Text>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.5 : pressed && onPress ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={theme.text} />
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      {detail && (
        <Text style={[styles.rowDetail, { color: theme.subtext }]}>{detail}</Text>
      )}
      {onPress && !disabled && (
        <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginLeft: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  rowLabel: { fontSize: 16, fontWeight: "500", flex: 1 },
  rowDetail: { fontSize: 15 },
});

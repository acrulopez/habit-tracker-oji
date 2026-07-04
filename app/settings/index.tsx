import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useHabitStore } from "../../src/store/useHabitStore";
import { Icon, type IconName } from "../../src/components/Icon";
import * as cloudBackup from "../../src/data/cloudBackup";
import { relativeTimeFromNow } from "../../src/lib/dates";
import { useTheme } from "../../src/theme/theme";

function backupDetail(enabled: boolean): string {
  if (!enabled) return "Off";
  if (!cloudBackup.isCloudAvailable()) return "Sign in to iCloud to back up";
  if (cloudBackup.hasQuotaWarning()) return "Backup full — using local copy";
  const last = cloudBackup.getLastBackupTime();
  return last ? relativeTimeFromNow(last) : "Not backed up yet";
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const habitCount = useHabitStore((s) => s.habits.length);
  const [backupEnabled, setBackupEnabled] = useState(() =>
    cloudBackup.isBackupEnabled(),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevronLeft" size={28} color={theme.text} />
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
            icon="swapVertical"
            label="Reorder habits"
            detail={habitCount < 2 ? "Add a few habits first" : undefined}
            disabled={habitCount < 2}
            onPress={() => router.push("/settings/reorder")}
          />
        </Section>

        {Platform.OS === "ios" && (
          <Section title="Backup">
            <ToggleRow
              icon="cloud"
              label="iCloud Backup"
              value={backupEnabled}
              onValueChange={(v) => {
                cloudBackup.setBackupEnabled(v);
                setBackupEnabled(v);
              }}
            />
            <Row
              icon="clock"
              label="Last backed up"
              detail={backupDetail(backupEnabled)}
            />
          </Section>
        )}

        <Section title="Appearance">
          <Row
            icon="contrast"
            label="Theme"
            detail="Automatic (follows system)"
          />
        </Section>

        <Section title="About">
          <Row icon="info" label="Habit Tracker Oji" detail={`v${Constants.expoConfig?.version ?? "1.0.0"}`} />
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
  icon: IconName;
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
      <Icon name={icon} size={22} color={theme.text} />
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      {detail && (
        <Text style={[styles.rowDetail, { color: theme.subtext }]}>{detail}</Text>
      )}
      {onPress && !disabled && (
        <Icon name="chevronRight" size={20} color={theme.subtext} />
      )}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: IconName;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={22} color={theme.text} />
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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

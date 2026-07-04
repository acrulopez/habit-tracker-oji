import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { habitRepository } from "../../../src/data/habitRepository";
import { MonthCalendar } from "../../../src/components/MonthCalendar";
import {
  currentStreak,
  longestStreak,
  totalCompletions,
} from "../../../src/lib/streaks";
import { todayKey } from "../../../src/lib/dates";
import { useTheme } from "../../../src/theme/theme";
import { useHabitStore } from "../../../src/store/useHabitStore";
import { Icon } from "../../../src/components/Icon";

export default function HistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabitStore((s) => s.habits.find((h) => h.id === id));
  const refreshStore = useHabitStore((s) => s.refresh);

  const [dates, setDates] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (id) setDates(habitRepository.getCompletions(id));
    }, [id]),
  );

  const toggleDate = (date: string) => {
    if (!id) return;
    habitRepository.toggleCompletion(id, date);
    setDates(habitRepository.getCompletions(id));
    // Keep the home screen + widget in sync with edits made here.
    refreshStore();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevronLeft" size={28} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.headerEmoji}>{habit?.emoji ?? "📊"}</Text>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {habit?.name ?? "History"}
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={styles.statsRow}>
          <StatCard
            label="Current streak"
            value={`${currentStreak(dates)}`}
            suffix="days"
          />
          <StatCard
            label="Longest streak"
            value={`${longestStreak(dates)}`}
            suffix="days"
          />
          <StatCard label="Total" value={`${totalCompletions(dates)}`} suffix="days" />
        </View>

        <MonthCalendar
          completedDates={dates}
          onToggleDate={toggleDate}
          maxDate={todayKey()}
        />
        <Text style={[styles.hint, { color: theme.subtext }]}>
          Tap any day to mark it done or undo it.
        </Text>
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.accent }]}>{value}</Text>
      <Text style={[styles.statSuffix, { color: theme.subtext }]}>{suffix}</Text>
      <Text style={[styles.statLabel, { color: theme.subtext }]}>{label}</Text>
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
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  headerEmoji: { fontSize: 22 },
  headerName: { fontSize: 18, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "800" },
  statSuffix: { fontSize: 12, marginTop: -2 },
  statLabel: { fontSize: 12, marginTop: 6, textAlign: "center" },
  hint: { fontSize: 13, textAlign: "center", marginTop: 4 },
});

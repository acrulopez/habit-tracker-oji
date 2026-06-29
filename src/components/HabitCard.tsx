import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Habit } from "../data/types";
import { recentDayLabel } from "../lib/dates";
import { useTheme } from "../theme/theme";

type Props = {
  habit: Habit;
  /** Recent day keys, oldest first. */
  days: string[];
  doneByDate: Record<string, boolean>;
  today: string;
  onToggleDay: (date: string) => void;
  onMenu: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
};

export function HabitCard({
  habit,
  days,
  doneByDate,
  today,
  onToggleDay,
  onMenu,
  onLongPress,
  isActive,
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isActive ? theme.cardPressed : theme.card,
          borderColor: theme.border,
          shadowOpacity: isActive ? 0.2 : 0,
        },
      ]}
    >
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={200}
        style={styles.identity}
        accessibilityLabel={`${habit.name}. Hold to reorder.`}
      >
        <View style={[styles.emojiCircle, { backgroundColor: theme.background }]}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {habit.name}
        </Text>
      </Pressable>

      <View style={styles.days}>
        {days.map((date) => {
          const done = !!doneByDate[date];
          const isToday = date === today;
          return (
            <Pressable
              key={date}
              onPress={() => onToggleDay(date)}
              hitSlop={6}
              accessibilityLabel={`${recentDayLabel(date, today)} ${
                done ? "done" : "not done"
              }`}
              style={styles.dayCell}
            >
              <Text style={[styles.dayLabel, { color: theme.subtext }]}>
                {recentDayLabel(date, today)}
              </Text>
              <View
                style={[
                  styles.dot,
                  isToday && styles.dotToday,
                  done
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { borderColor: theme.border },
                ]}
              >
                {done && (
                  <Ionicons name="checkmark" size={isToday ? 16 : 13} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onMenu}
        hitSlop={10}
        accessibilityLabel={`Options for ${habit.name}`}
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={theme.subtext} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    shadowColor: "#000",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 23 },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
  days: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  dayCell: { alignItems: "center", gap: 4, width: 34 },
  dayLabel: { fontSize: 10, fontWeight: "600" },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotToday: { width: 30, height: 30, borderRadius: 15 },
  menuButton: { paddingLeft: 2, paddingVertical: 4 },
});

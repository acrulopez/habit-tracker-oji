import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useRouter } from "expo-router";
import { useHabitStore } from "../src/store/useHabitStore";
import { HabitCard } from "../src/components/HabitCard";
import { HabitMenu } from "../src/components/HabitMenu";
import { Icon } from "../src/components/Icon";
import { useTheme } from "../src/theme/theme";
import type { Habit } from "../src/data/types";

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const habits = useHabitStore((s) => s.habits);
  const recentDays = useHabitStore((s) => s.recentDays);
  const doneByHabit = useHabitStore((s) => s.doneByHabit);
  const today = useHabitStore((s) => s.today);
  const toggleDay = useHabitStore((s) => s.toggleDay);
  const reorder = useHabitStore((s) => s.reorder);
  const removeHabit = useHabitStore((s) => s.removeHabit);

  const [menuHabit, setMenuHabit] = useState<Habit | null>(null);

  const confirmDelete = (habit: Habit) => {
    setMenuHabit(null);
    Alert.alert("Delete habit", `Delete "${habit.name}" and all its history?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeHabit(habit.id),
      },
    ]);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Habit>) => (
    <ScaleDecorator>
      <View style={styles.row}>
        <HabitCard
          habit={item}
          days={recentDays}
          doneByDate={doneByHabit[item.id] ?? {}}
          today={today}
          onToggleDay={(date) => toggleDay(item.id, date)}
          onLongPress={drag}
          isActive={isActive}
          onMenu={() => setMenuHabit(item)}
        />
      </View>
    </ScaleDecorator>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Habits</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            {habits.length === 0
              ? "Build your first habit"
              : "Tap a day to check it off"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="settings" size={22} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Add habit"
            onPress={() => router.push("/habit/new")}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon name="add" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <DraggableFlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((h) => h.id))}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          gap: 12,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No habits yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              Tap the + button to create one.
            </Text>
          </View>
        }
      />

      <HabitMenu
        habit={menuHabit}
        onClose={() => setMenuHabit(null)}
        onHistory={(habit) => {
          setMenuHabit(null);
          router.push(`/habit/${habit.id}/history`);
        }}
        onEdit={(habit) => {
          setMenuHabit(null);
          router.push(`/habit/${habit.id}/edit`);
        }}
        onDelete={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 34, fontWeight: "800" },
  subtitle: { fontSize: 15, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { marginBottom: 0 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyText: { fontSize: 15 },
});

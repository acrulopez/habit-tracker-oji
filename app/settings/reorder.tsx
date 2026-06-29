import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useHabitStore } from "../../src/store/useHabitStore";
import { useTheme } from "../../src/theme/theme";
import type { Habit } from "../../src/data/types";

export default function ReorderScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);
  const reorder = useHabitStore((s) => s.reorder);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Habit>) => (
    <ScaleDecorator>
      <Pressable
        onLongPress={drag}
        delayLongPress={150}
        style={[
          styles.row,
          {
            backgroundColor: isActive ? theme.cardPressed : theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {/* Press-and-drag the handle to move the row. */}
        <Pressable onPressIn={drag} hitSlop={12} accessibilityLabel={`Drag ${item.name}`}>
          <Ionicons name="reorder-three" size={26} color={theme.subtext} />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Reorder habits</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={[styles.hint, { color: theme.subtext }]}>
        Drag the handle (or press and hold a row) to change the order.
      </Text>

      <DraggableFlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((h) => h.id))}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
      />
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
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700" },
  hint: { fontSize: 13, textAlign: "center", paddingHorizontal: 24, paddingBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  emoji: { fontSize: 24 },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
});

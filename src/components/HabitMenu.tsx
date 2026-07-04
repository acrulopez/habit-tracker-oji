import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Habit } from "../data/types";
import { useTheme } from "../theme/theme";
import { Icon, type IconName } from "./Icon";

type Props = {
  habit: Habit | null;
  onClose: () => void;
  onHistory: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
};

export function HabitMenu({
  habit,
  onClose,
  onHistory,
  onEdit,
  onDelete,
}: Props) {
  const theme = useTheme();
  const visible = habit !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          {habit && (
            <>
              <View style={styles.header}>
                <Text style={styles.headerEmoji}>{habit.emoji}</Text>
                <Text
                  style={[styles.headerName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {habit.name}
                </Text>
              </View>

              <MenuItem
                icon="calendar"
                label="View history"
                color={theme.text}
                onPress={() => onHistory(habit)}
              />
              <MenuItem
                icon="edit"
                label="Edit"
                color={theme.text}
                onPress={() => onEdit(habit)}
              />
              <MenuItem
                icon="trash"
                label="Delete"
                color={theme.danger}
                onPress={() => onDelete(habit)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={22} color={color} />
      <Text style={[styles.itemLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
  },
  headerEmoji: { fontSize: 24 },
  headerName: { fontSize: 18, fontWeight: "700", flex: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  itemLabel: { fontSize: 17, fontWeight: "500" },
});

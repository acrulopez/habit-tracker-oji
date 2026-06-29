import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { HabitForm } from "../../../src/components/HabitForm";
import { useHabitStore } from "../../../src/store/useHabitStore";
import { useTheme } from "../../../src/theme/theme";

export default function EditHabitScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabitStore((s) => s.habits.find((h) => h.id === id));
  const editHabit = useHabitStore((s) => s.editHabit);

  if (!habit) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <Text style={{ color: theme.subtext }}>Habit not found</Text>
      </View>
    );
  }

  return (
    <HabitForm
      title="Edit habit"
      submitLabel="Save changes"
      initialName={habit.name}
      initialEmoji={habit.emoji}
      onCancel={() => router.back()}
      onSubmit={(values) => {
        editHabit(habit.id, values);
        router.back();
      }}
    />
  );
}

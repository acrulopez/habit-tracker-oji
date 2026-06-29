import { useRouter } from "expo-router";
import { HabitForm } from "../../src/components/HabitForm";
import { useHabitStore } from "../../src/store/useHabitStore";

export default function NewHabitScreen() {
  const router = useRouter();
  const addHabit = useHabitStore((s) => s.addHabit);

  return (
    <HabitForm
      title="New habit"
      submitLabel="Create habit"
      onCancel={() => router.back()}
      onSubmit={(values) => {
        addHabit(values);
        router.back();
      }}
    />
  );
}

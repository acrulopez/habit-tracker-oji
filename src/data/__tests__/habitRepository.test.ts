import { createHabitRepository } from "../habitRepository";
import { createMemoryKv } from "../mmkv";
import { todayKey } from "../../lib/dates";

function makeRepo() {
  let counter = 0;
  const idFactory = () => `id-${++counter}`;
  return createHabitRepository(createMemoryKv(), idFactory);
}

describe("habitRepository", () => {
  test("creates and lists habits in order", () => {
    const repo = makeRepo();
    repo.createHabit({ name: "Water", emoji: "💧" });
    repo.createHabit({ name: "Read", emoji: "📚" });
    const habits = repo.listHabits();
    expect(habits.map((h) => h.name)).toEqual(["Water", "Read"]);
    expect(habits[0].order).toBe(0);
    expect(habits[1].order).toBe(1);
  });

  test("trims the habit name on create", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "  Stretch  ", emoji: "🤸" });
    expect(habit.name).toBe("Stretch");
  });

  test("toggleToday flips completion and is reflected in isDoneOn", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "Water", emoji: "💧" });
    expect(repo.isDoneOn(habit.id, todayKey())).toBe(false);
    expect(repo.toggleToday(habit.id)).toBe(true);
    expect(repo.isDoneOn(habit.id, todayKey())).toBe(true);
    expect(repo.toggleToday(habit.id)).toBe(false);
    expect(repo.isDoneOn(habit.id, todayKey())).toBe(false);
  });

  test("setCompletion is idempotent", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "Water", emoji: "💧" });
    repo.setCompletion(habit.id, "2026-06-01", true);
    repo.setCompletion(habit.id, "2026-06-01", true);
    expect(repo.getCompletions(habit.id)).toEqual(["2026-06-01"]);
    repo.setCompletion(habit.id, "2026-06-01", false);
    expect(repo.getCompletions(habit.id)).toEqual([]);
  });

  test("getCompletions returns sorted, de-duplicated dates", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "Water", emoji: "💧" });
    repo.setCompletion(habit.id, "2026-06-03", true);
    repo.setCompletion(habit.id, "2026-06-01", true);
    repo.setCompletion(habit.id, "2026-06-02", true);
    expect(repo.getCompletions(habit.id)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  test("updateHabit changes name and emoji", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "Water", emoji: "💧" });
    repo.updateHabit(habit.id, { name: "Hydrate", emoji: "🚰" });
    const updated = repo.getHabit(habit.id);
    expect(updated?.name).toBe("Hydrate");
    expect(updated?.emoji).toBe("🚰");
  });

  test("deleteHabit removes habit and its completions", () => {
    const repo = makeRepo();
    const habit = repo.createHabit({ name: "Water", emoji: "💧" });
    repo.toggleToday(habit.id);
    repo.deleteHabit(habit.id);
    expect(repo.listHabits()).toHaveLength(0);
    expect(repo.getCompletions(habit.id)).toEqual([]);
  });

  test("reorderHabits persists new order", () => {
    const repo = makeRepo();
    const a = repo.createHabit({ name: "A", emoji: "🅰️" });
    const b = repo.createHabit({ name: "B", emoji: "🅱️" });
    const c = repo.createHabit({ name: "C", emoji: "🇨" });
    repo.reorderHabits([c.id, a.id, b.id]);
    expect(repo.listHabits().map((h) => h.name)).toEqual(["C", "A", "B"]);
  });

  test("new habits get the next order after reordering", () => {
    const repo = makeRepo();
    const a = repo.createHabit({ name: "A", emoji: "🅰️" });
    const b = repo.createHabit({ name: "B", emoji: "🅱️" });
    repo.reorderHabits([b.id, a.id]);
    const c = repo.createHabit({ name: "C", emoji: "🇨" });
    // C should land last, not collide with an existing order.
    expect(repo.listHabits().map((h) => h.name)).toEqual(["B", "A", "C"]);
  });
});

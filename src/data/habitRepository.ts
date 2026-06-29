import { generateId } from "../lib/id";
import { todayKey } from "../lib/dates";
import { getKv, type Kv } from "./mmkv";
import type { Habit } from "./types";

const HABITS_KEY = "habits";
const completionsKey = (habitId: string) => `completions:${habitId}`;

export type HabitInput = { name: string; emoji: string };

export type HabitRepository = ReturnType<typeof createHabitRepository>;

/**
 * Local-only persistence for habits and their per-day completions, backed by a
 * Kv store. This is the single seam a future cloud-sync backend would replace
 * or wrap — UI and widgets only talk to this repository, never to MMKV directly.
 */
export function createHabitRepository(
  kv: Kv = getKv(),
  idFactory: () => string = generateId,
) {
  function readHabits(): Habit[] {
    const raw = kv.getString(HABITS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Habit[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHabits(habits: Habit[]): void {
    kv.set(HABITS_KEY, JSON.stringify(habits));
  }

  function readCompletions(habitId: string): string[] {
    const raw = kv.getString(completionsKey(habitId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCompletions(habitId: string, dates: string[]): void {
    // Store a sorted, de-duplicated list for stable output.
    const unique = Array.from(new Set(dates)).sort();
    kv.set(completionsKey(habitId), JSON.stringify(unique));
  }

  return {
    listHabits(): Habit[] {
      return readHabits()
        .filter((h) => !h.archived)
        .sort((a, b) => a.order - b.order);
    },

    getHabit(id: string): Habit | undefined {
      return readHabits().find((h) => h.id === id);
    },

    createHabit(input: HabitInput): Habit {
      const habits = readHabits();
      const maxOrder = habits.reduce((m, h) => Math.max(m, h.order), -1);
      const habit: Habit = {
        id: idFactory(),
        name: input.name.trim(),
        emoji: input.emoji,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
      };
      writeHabits([...habits, habit]);
      return habit;
    },

    updateHabit(id: string, input: Partial<HabitInput>): void {
      const habits = readHabits().map((h) =>
        h.id === id
          ? {
              ...h,
              name: input.name !== undefined ? input.name.trim() : h.name,
              emoji: input.emoji !== undefined ? input.emoji : h.emoji,
            }
          : h,
      );
      writeHabits(habits);
    },

    deleteHabit(id: string): void {
      writeHabits(readHabits().filter((h) => h.id !== id));
      kv.remove(completionsKey(id));
    },

    /** Persist a new ordering given the full list of habit ids in display order. */
    reorderHabits(orderedIds: string[]): void {
      const position = new Map(orderedIds.map((id, index) => [id, index]));
      const habits = readHabits().map((h) => ({
        ...h,
        order: position.get(h.id) ?? h.order,
      }));
      writeHabits(habits);
    },

    getCompletions(habitId: string): string[] {
      return readCompletions(habitId);
    },

    isDoneOn(habitId: string, date: string): boolean {
      return readCompletions(habitId).includes(date);
    },

    /** Explicitly set a completion on/off for a date. Idempotent. */
    setCompletion(habitId: string, date: string, done: boolean): void {
      const dates = new Set(readCompletions(habitId));
      if (done) dates.add(date);
      else dates.delete(date);
      writeCompletions(habitId, Array.from(dates));
    },

    /** Toggle a completion for a date. Returns the resulting done state. */
    toggleCompletion(habitId: string, date: string): boolean {
      const dates = new Set(readCompletions(habitId));
      const next = !dates.has(date);
      if (next) dates.add(date);
      else dates.delete(date);
      writeCompletions(habitId, Array.from(dates));
      return next;
    },

    toggleToday(habitId: string): boolean {
      return this.toggleCompletion(habitId, todayKey());
    },
  };
}

/** App-wide singleton repository (uses the native MMKV store). */
export const habitRepository = createHabitRepository();

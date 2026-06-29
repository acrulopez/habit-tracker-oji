import { lastNDays, todayKey } from "../lib/dates";
import { habitRepository, type HabitRepository } from "../data/habitRepository";
import type { TodaySnapshot } from "../data/types";

/** Number of recent days shown (and toggleable) in the widgets. */
export const WIDGET_DAYS = 3;

/** Build the compact snapshot the home-screen widgets render. */
export function buildTodaySnapshot(
  repo: HabitRepository = habitRepository,
): TodaySnapshot {
  const date = todayKey();
  const dayKeys = lastNDays(WIDGET_DAYS, date);
  const habits = repo.listHabits().map((h) => ({
    id: h.id,
    name: h.name,
    emoji: h.emoji,
    days: dayKeys.map((d) => ({ date: d, done: repo.isDoneOn(h.id, d) })),
  }));
  return { date, habits };
}

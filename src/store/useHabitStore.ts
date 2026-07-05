import { InteractionManager } from "react-native";
import { create } from "zustand";
import { habitRepository, type HabitInput } from "../data/habitRepository";
import type { Habit } from "../data/types";
import { lastNDays, todayKey } from "../lib/dates";
import { WIDGET_DAYS } from "../widget/snapshot";
import { syncWidget } from "../widget/syncWidget";
import { reconcileWidgetToggles } from "../widget/reconcile";
import * as cloudBackup from "../data/cloudBackup";

/** done state for a habit across the recent days: dateKey -> done. */
type DoneByDate = Record<string, boolean>;

type HabitState = {
  habits: Habit[];
  /** The recent day keys shown on the home cards, oldest first. */
  recentDays: string[];
  /** habitId -> { dateKey -> done } for the recent days. */
  doneByHabit: Record<string, DoneByDate>;
  today: string;
  hydrated: boolean;

  /** Reload from storage (also drains widget toggles + republishes snapshot). */
  refresh: () => void;
  addHabit: (input: HabitInput) => void;
  editHabit: (id: string, input: Partial<HabitInput>) => void;
  removeHabit: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  /** Toggle a specific date for a habit (used by the recent-day cells). */
  toggleDay: (id: string, date: string) => void;
};

function computeDoneByHabit(
  habits: Habit[],
  days: string[],
): Record<string, DoneByDate> {
  const map: Record<string, DoneByDate> = {};
  for (const h of habits) {
    const byDate: DoneByDate = {};
    for (const d of days) byDate[d] = habitRepository.isDoneOn(h.id, d);
    map[h.id] = byDate;
  }
  return map;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  recentDays: lastNDays(WIDGET_DAYS),
  doneByHabit: {},
  today: todayKey(),
  hydrated: false,

  refresh: () => {
    // Pull in any completions toggled from the iOS widget while we were away.
    const drained = reconcileWidgetToggles();
    const today = todayKey();
    const recentDays = lastNDays(WIDGET_DAYS, today);
    const habits = habitRepository.listHabits();
    set({
      habits,
      today,
      recentDays,
      doneByHabit: computeDoneByHabit(habits, recentDays),
      hydrated: true,
    });
    syncWidget();
    // Widget taps are real local changes — back them up too.
    if (drained) cloudBackup.scheduleUpload();
  },

  addHabit: (input) => {
    habitRepository.createHabit(input);
    get().refresh();
    cloudBackup.scheduleUpload();
  },

  editHabit: (id, input) => {
    habitRepository.updateHabit(id, input);
    get().refresh();
    cloudBackup.scheduleUpload();
  },

  removeHabit: (id) => {
    habitRepository.deleteHabit(id);
    get().refresh();
    cloudBackup.scheduleUpload();
  },

  reorder: (orderedIds) => {
    // Do only the cheap, visible work synchronously so the drop animation
    // settles instantly; defer the widget/cloud sync until the drag
    // interaction finishes so its native bridge calls don't block the JS
    // thread mid-animation.
    habitRepository.reorderHabits(orderedIds);
    const byId = new Map(get().habits.map((h) => [h.id, h]));
    const habits = orderedIds
      .map((id) => byId.get(id))
      .filter((h): h is Habit => Boolean(h));
    set({ habits });
    InteractionManager.runAfterInteractions(() => {
      // Reorder doesn't touch completions, but draining here keeps the
      // republished snapshot consistent with any pending widget taps.
      reconcileWidgetToggles();
      syncWidget();
      cloudBackup.scheduleUpload();
    });
  },

  toggleDay: (id, date) => {
    // Drain widget toggles first so this publish doesn't discard queued changes.
    reconcileWidgetToggles();
    habitRepository.toggleCompletion(id, date);
    const { habits, recentDays } = get();
    set({ doneByHabit: computeDoneByHabit(habits, recentDays) });
    syncWidget();
    cloudBackup.scheduleUpload();
  },
}));

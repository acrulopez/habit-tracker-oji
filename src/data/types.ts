export type Habit = {
  id: string;
  name: string;
  emoji: string;
  /** Lower numbers appear first. */
  order: number;
  /** ISO timestamp. */
  createdAt: string;
  archived?: boolean;
};

/** Completion state for a single day. */
export type WidgetDay = {
  /** Local date key, "YYYY-MM-DD". */
  date: string;
  done: boolean;
};

/** A single habit as projected into the home-screen widget. */
export type WidgetHabit = {
  id: string;
  name: string;
  emoji: string;
  /** The recent days shown in the widget, oldest first (e.g. -2, -1, today). */
  days: WidgetDay[];
};

/** Compact snapshot the widgets read to render the recent days. */
export type TodaySnapshot = {
  /** Local date key for "today" when the snapshot was built. */
  date: string;
  habits: WidgetHabit[];
};

/** A completion toggle performed from the widget while the app was closed. */
export type PendingToggle = {
  habitId: string;
  date: string;
  done: boolean;
};

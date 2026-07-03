import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { TodaySnapshot, WidgetHabit } from "../data/types";
import { recentDayLabel } from "../lib/dates";
import { COLUMNS, DEFAULT_WIDGET_LAYOUT } from "./widgetLayout";

// Card + cell colors (kept in sync with targets/widget/index.swift).
const CARD_BG = "#17171A";
const CELL_DONE = "#F97316"; // warm orange
const CELL_MUTED = "#3A3A3C"; // muted dark

/** Split a list into consecutive chunks of `size`. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A single tappable day cell — a bare rounded square, filled when done. */
function DaySquare({
  habit,
  offset,
  date,
  done,
  today,
}: {
  habit: WidgetHabit;
  offset: number;
  date: string;
  done: boolean;
  today: string;
}) {
  return (
    <FlexWidget
      clickAction="TOGGLE_HABIT"
      // Pass the day's offset (0 = oldest … last = today). The handler resolves
      // it against the *current* day at tap time, so a stale render can't toggle
      // the wrong date after midnight.
      clickActionData={{ habitId: habit.id, offset }}
      accessibilityLabel={`Toggle ${habit.name} on ${recentDayLabel(date, today)}`}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: done ? CELL_DONE : CELL_MUTED,
      }}
    />
  );
}

/**
 * One habit: emoji on the left, then either the full 3-day strip or just today's
 * square (narrow widget). Offsets are preserved so a tap toggles the right date.
 */
function HabitCell({
  habit,
  today,
  todayOnly,
  align,
}: {
  habit: WidgetHabit;
  today: string;
  todayOnly: boolean;
  /** How the emoji+squares group sits in its column cell. */
  align: "flex-start" | "center";
}) {
  const days = todayOnly ? habit.days.slice(-1) : habit.days;
  const baseOffset = habit.days.length - days.length;
  return (
    <FlexWidget
      style={{
        // Small: each cell fills half the row (align controls where content
        // sits). Wide: natural width so the row's space-evenly can distribute
        // the two groups with equal left/middle/right gaps.
        ...(todayOnly ? { flex: 1 } : {}),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: todayOnly ? align : "flex-start",
        // Tighter gap on the narrow (today-only) widget so wide emojis don't clip.
        flexGap: todayOnly ? 6 : 10,
      }}
    >
      <TextWidget text={habit.emoji} style={{ fontSize: todayOnly ? 17 : 20 }} />
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
        {days.map((day, i) => (
          <DaySquare
            key={day.date}
            habit={habit}
            offset={baseOffset + i}
            date={day.date}
            done={day.done}
            today={today}
          />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

/** Android home-screen widget UI (rendered to RemoteViews). */
export function HabitsWidget({
  snapshot,
  todayOnly = DEFAULT_WIDGET_LAYOUT.todayOnly,
  maxRows = DEFAULT_WIDGET_LAYOUT.maxRows,
}: {
  snapshot: TodaySnapshot;
  todayOnly?: boolean;
  maxRows?: number;
}) {
  const today = snapshot?.date ?? "";
  const habits = (snapshot?.habits ?? []).slice(0, COLUMNS * Math.max(1, maxRows));
  const gridRows = chunk(habits, COLUMNS);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        // Top-aligned rows with a fixed gap; a tall widget with few habits just
        // leaves space below (fills as habits are added).
        justifyContent: "flex-start",
        flexGap: 14,
        padding: 14,
        borderRadius: 20,
        backgroundColor: CARD_BG,
      }}
    >
      {habits.length === 0 ? (
        <TextWidget
          text="No habits yet — open the app to add one"
          style={{ color: "#9CA3AF", fontSize: 14 }}
        />
      ) : (
        gridRows.map((rowHabits, rowIndex) => (
          <FlexWidget
            key={rowIndex}
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              // Small keeps flex cells (align controls placement); wide uses
              // space-evenly to give equal left/middle/right gaps.
              justifyContent: todayOnly ? "space-between" : "space-evenly",
              flexGap: todayOnly ? 12 : 0,
            }}
          >
            {rowHabits.map((habit, colIndex) => (
              <HabitCell
                key={habit.id}
                habit={habit}
                today={today}
                todayOnly={todayOnly}
                // Small: left column hugs the leading edge, right column centers
                // in its half. (Ignored in the wide space-evenly layout.)
                align={colIndex === 0 ? "flex-start" : "center"}
              />
            ))}
            {/* Small: pad the final row with empty flex cells so partial rows
                stay aligned. Wide uses space-evenly, so no padding needed. */}
            {todayOnly &&
              Array.from({ length: COLUMNS - rowHabits.length }).map((_, i) => (
                <FlexWidget key={`pad-${i}`} style={{ flex: 1 }} />
              ))}
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}

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

/**
 * A single tappable day cell — a rounded square centered in its full cell slot
 * (the slot stays the layout/tap unit), filled and slightly bigger when done.
 */
function DaySquare({
  habit,
  offset,
  date,
  done,
  today,
  cell,
  box,
  boxDone,
  cornerRadius,
}: {
  habit: WidgetHabit;
  offset: number;
  date: string;
  done: boolean;
  today: string;
  cell: number;
  box: number;
  boxDone: number;
  cornerRadius: number;
}) {
  const size = done ? boxDone : box;
  return (
    <FlexWidget
      clickAction="TOGGLE_HABIT"
      // Pass the day's offset (0 = oldest … last = today). The handler resolves
      // it against the *current* day at tap time, so a stale render can't toggle
      // the wrong date after midnight.
      clickActionData={{ habitId: habit.id, offset }}
      accessibilityLabel={`Toggle ${habit.name} on ${recentDayLabel(date, today)}`}
      style={{ width: cell, height: cell, alignItems: "center", justifyContent: "center" }}
    >
      <FlexWidget
        style={{
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: done ? CELL_DONE : CELL_MUTED,
        }}
      />
    </FlexWidget>
  );
}

/** The emoji icon — its cell is sized to the emoji, a bit larger than a box slot. */
function IconCell({ emoji, emojiFontSize }: { emoji: string; emojiFontSize: number }) {
  return (
    <FlexWidget
      style={{
        width: emojiFontSize,
        height: emojiFontSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget text={emoji} style={{ fontSize: emojiFontSize }} />
    </FlexWidget>
  );
}

/**
 * Flat list of cells for one habit — `[icon, …day boxes]` — as siblings, so a
 * row's `space-evenly` distributes every cell (icons and boxes alike) with equal
 * spacing between them and equal margins at the edges. Offsets are preserved so a
 * tap toggles the right date.
 */
function habitCells(
  habit: WidgetHabit,
  today: string,
  todayOnly: boolean,
  cell: number,
  box: number,
  boxDone: number,
  cornerRadius: number,
  emojiFontSize: number,
): React.ReactElement[] {
  const days = todayOnly ? habit.days.slice(-1) : habit.days;
  const baseOffset = habit.days.length - days.length;
  return [
    <IconCell key={`${habit.id}-icon`} emoji={habit.emoji} emojiFontSize={emojiFontSize} />,
    ...days.map((day, i) => (
      <DaySquare
        key={`${habit.id}-${day.date}`}
        habit={habit}
        offset={baseOffset + i}
        date={day.date}
        done={day.done}
        today={today}
        cell={cell}
        box={box}
        boxDone={boxDone}
        cornerRadius={cornerRadius}
      />
    )),
  ];
}

/** Android home-screen widget UI (rendered to RemoteViews). */
export function HabitsWidget({
  snapshot,
  todayOnly = DEFAULT_WIDGET_LAYOUT.todayOnly,
  maxRows = DEFAULT_WIDGET_LAYOUT.maxRows,
  cell = DEFAULT_WIDGET_LAYOUT.cell,
  box = DEFAULT_WIDGET_LAYOUT.box,
  boxDone = DEFAULT_WIDGET_LAYOUT.boxDone,
  verticalSpacing = DEFAULT_WIDGET_LAYOUT.verticalSpacing,
  cornerRadius = DEFAULT_WIDGET_LAYOUT.cornerRadius,
  emojiFontSize = DEFAULT_WIDGET_LAYOUT.emojiFontSize,
}: {
  snapshot: TodaySnapshot;
  todayOnly?: boolean;
  maxRows?: number;
  cell?: number;
  box?: number;
  boxDone?: number;
  verticalSpacing?: number;
  cornerRadius?: number;
  emojiFontSize?: number;
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
        // Top-aligned rows with a uniform vertical gap sized so a full widget
        // fills its height evenly; the row's space-evenly owns the horizontal
        // end margins so they equal the gaps between cells.
        justifyContent: "flex-start",
        flexGap: verticalSpacing,
        paddingVertical: verticalSpacing,
        paddingHorizontal: 0,
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
            }}
          >
            {/* Each habit is its own even-filled group (space-evenly) in an equal
                (flex:1) column, so its boxes stay grouped and the two columns
                split the width. */}
            {rowHabits.map((habit) => (
              <FlexWidget
                key={habit.id}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-evenly",
                }}
              >
                {habitCells(habit, today, todayOnly, cell, box, boxDone, cornerRadius, emojiFontSize)}
              </FlexWidget>
            ))}
            {/* Pad a partial last row so its habit stays under column 1. */}
            {Array.from({ length: COLUMNS - rowHabits.length }).map((_, i) => (
              <FlexWidget key={`pad-${i}`} style={{ flex: 1 }} />
            ))}
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}

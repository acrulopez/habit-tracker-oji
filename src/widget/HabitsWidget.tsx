import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { TodaySnapshot } from "../data/types";
import { recentDayLabel } from "../lib/dates";

const MAX_ROWS = 5;

/** Android home-screen widget UI (rendered to RemoteViews). */
export function HabitsWidget({ snapshot }: { snapshot: TodaySnapshot }) {
  const habits = snapshot?.habits ?? [];
  const today = snapshot?.date ?? "";

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "flex-start",
        flexGap: 8,
        padding: 14,
        borderRadius: 20,
        backgroundColor: "#0E0E10",
      }}
    >
      {habits.length === 0 ? (
        <TextWidget
          text="No habits yet — open the app to add one"
          style={{ color: "#9CA3AF", fontSize: 14 }}
        />
      ) : (
        habits.slice(0, MAX_ROWS).map((habit) => (
          <FlexWidget
            key={habit.id}
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexGap: 8,
            }}
          >
            <FlexWidget
              style={{ flexDirection: "row", alignItems: "center", flexGap: 6, flex: 1 }}
            >
              <TextWidget text={habit.emoji} style={{ fontSize: 16 }} />
              <TextWidget
                text={habit.name}
                truncate="END"
                maxLines={1}
                style={{ color: "#F5F5F7", fontSize: 14 }}
              />
            </FlexWidget>

            <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
              {habit.days.map((day, offset) => (
                <FlexWidget
                  key={day.date}
                  clickAction="TOGGLE_HABIT"
                  // Pass the day's offset (0 = oldest … last = today). The handler
                  // resolves it against the *current* day at tap time, so a stale
                  // render can't toggle the wrong date after midnight.
                  clickActionData={{ habitId: habit.id, offset }}
                  accessibilityLabel={`Toggle ${habit.name} on ${recentDayLabel(
                    day.date,
                    today,
                  )}`}
                  style={{ flexDirection: "column", alignItems: "center", flexGap: 2 }}
                >
                  <TextWidget
                    text={recentDayLabel(day.date, today)}
                    style={{ color: "#9CA3AF", fontSize: 9 }}
                  />
                  <FlexWidget
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: day.done ? "#22C55E" : "#26262C",
                    }}
                  >
                    <TextWidget
                      text={day.done ? "✓" : ""}
                      style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}
                    />
                  </FlexWidget>
                </FlexWidget>
              ))}
            </FlexWidget>
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}

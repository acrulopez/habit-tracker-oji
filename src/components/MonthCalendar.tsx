import React, { useMemo } from "react";
import { Calendar } from "react-native-calendars";
import type { MarkedDates } from "react-native-calendars/src/types";
import { useTheme } from "../theme/theme";

export function MonthCalendar({
  completedDates,
  onToggleDate,
  maxDate,
}: {
  completedDates: string[];
  /** Called when a day is tapped to toggle its completion. */
  onToggleDate?: (date: string) => void;
  /** Latest selectable day (e.g. today) — future days are disabled. */
  maxDate?: string;
}) {
  const theme = useTheme();

  const marked = useMemo<MarkedDates>(() => {
    const m: MarkedDates = {};
    for (const d of completedDates) {
      m[d] = { selected: true, selectedColor: theme.accent };
    }
    return m;
  }, [completedDates, theme.accent]);

  return (
    <Calendar
      markedDates={marked}
      enableSwipeMonths
      maxDate={maxDate}
      disableMonthChange
      onDayPress={(day) => onToggleDate?.(day.dateString)}
      theme={{
        calendarBackground: theme.card,
        dayTextColor: theme.text,
        monthTextColor: theme.text,
        textDisabledColor: theme.subtext,
        todayTextColor: theme.accent,
        arrowColor: theme.accent,
        textSectionTitleColor: theme.subtext,
        selectedDayTextColor: "#FFFFFF",
      }}
      style={{ borderRadius: 16, paddingBottom: 8 }}
    />
  );
}

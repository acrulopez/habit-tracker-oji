import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { HabitsWidget } from "./HabitsWidget";
import { habitRepository } from "../data/habitRepository";
import { buildTodaySnapshot, WIDGET_DAYS } from "./snapshot";
import { lastNDays, todayKey } from "../lib/dates";

/**
 * Headless JS task that handles Android widget lifecycle + click events.
 * Runs even when the app is closed, so tapping a day on the widget toggles that
 * completion directly in MMKV and re-renders the widget.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, clickAction, clickActionData, renderWidget } = props;

  if (widgetAction === "WIDGET_CLICK" && clickAction === "TOGGLE_HABIT") {
    const habitId = clickActionData?.habitId as string | undefined;
    // Resolve the tapped day offset against the current day, so a stale render
    // (e.g. after midnight) still toggles the correct date.
    const days = lastNDays(WIDGET_DAYS, todayKey());
    const offset = clickActionData?.offset as number | undefined;
    const date =
      typeof offset === "number" && days[offset] ? days[offset] : todayKey();
    if (habitId) {
      habitRepository.toggleCompletion(habitId, date);
    }
  }

  renderWidget(<HabitsWidget snapshot={buildTodaySnapshot()} />);
}

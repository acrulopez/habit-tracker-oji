import { getKv } from "../data/mmkv";

/**
 * Size-driven layout for the Android home-screen widget.
 *
 * Android can't tell us the widget's size during app-driven updates
 * (`requestWidgetUpdate` carries no `widgetInfo`), so we persist the last size
 * seen in the headless task handler (add / resize / update events) and derive
 * the layout from it. This is best-effort: iOS reads the widget family directly
 * and is exact.
 */
export type WidgetSize = {
  /** Widget width in dp. */
  width: number;
  /** Widget height in dp. */
  height: number;
};

export type WidgetLayout = {
  /**
   * Show only today's square per habit (narrow widget), instead of the full
   * 3-day strip. Lets a 2-column narrow widget pack ~8 habits.
   */
  todayOnly: boolean;
  /** Max habit rows that fit. */
  maxRows: number;
};

/** Habits are always laid out in two columns. */
export const COLUMNS = 2;

const WIDGET_SIZE_KEY = "widgetSize";

// Android widgets resize freely, so we grow the row count with the widget's
// height: roughly one habit row per ROW_HEIGHT_DP, minus the card's vertical
// padding, clamped so we never render an absurd number of rows.
const ROW_HEIGHT_DP = 44;
const PADDING_DP = 28;
const MAX_ROWS_CAP = 8;

// Two columns of the full 3-day strip only fit above this width; narrower than
// this we drop to a single "today" square per habit. Mirrors iOS Small vs
// Medium/Large.
const THREE_DAY_MIN_WIDTH_DP = 250;

/** Layout used when the widget size isn't known yet (wide, 3-day strip). */
export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = { todayOnly: false, maxRows: 2 };

/** Read the last-known widget size, or null if none has been recorded. */
export function getWidgetSize(): WidgetSize | null {
  const raw = getKv().getString(WIDGET_SIZE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetSize>;
    if (
      typeof parsed.width === "number" &&
      typeof parsed.height === "number" &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height)
    ) {
      return { width: parsed.width, height: parsed.height };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist the widget's current size (called from the headless task handler). */
export function setWidgetSize(size: WidgetSize): void {
  getKv().set(WIDGET_SIZE_KEY, JSON.stringify(size));
}

/** Derive the grid layout from a widget size (or the default when unknown). */
export function deriveLayout(size: WidgetSize | null): WidgetLayout {
  if (!size) return { ...DEFAULT_WIDGET_LAYOUT };
  const rows = Math.floor((size.height - PADDING_DP) / ROW_HEIGHT_DP);
  const maxRows = Math.min(MAX_ROWS_CAP, Math.max(1, rows));
  const todayOnly = size.width < THREE_DAY_MIN_WIDTH_DP;
  return { todayOnly, maxRows };
}

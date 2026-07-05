/**
 * Shared grid geometry for the home-screen widgets.
 *
 * Both widget implementations (iOS SwiftUI in `targets/widget/index.swift` and
 * Android in `src/widget/HabitsWidget.tsx`) render each habit as a row of equal
 * square cells: `[icon] [day box] …`. This module is the single source of truth
 * for how those cells are sized and spaced. iOS can't import TS, so the same
 * numbers are mirrored in `index.swift` (see the "Grid constants" block there —
 * keep them in sync, exactly like the color constants already are).
 *
 * The cells are a compact fixed size; the spacing then grows to fill the width
 * evenly, so every gap between cells — and both end margins — are equal
 * ("spread evenly to fill"). iOS applies the computed `spacing` explicitly;
 * Android gets the same look for free from `justifyContent: "space-evenly"`.
 */

/** Compact target size for a cell (icon/box); grown gaps do the filling. */
export const MAX_CELL = 20;
/** Never shrink a cell below this (keeps tiny widgets legible & tappable). */
export const MIN_CELL = 12;
/** Minimum spacing between cells / at the widget edges. */
export const MIN_GAP = 8;
/** Cell corner radius, as a fraction of the cell size. */
export const CORNER_RATIO = 0.28;
/** Emoji font size, as a fraction of the cell size (1.0 = fills the cell). */
export const EMOJI_SCALE = 1.0;
/** Reference grid resolution the spacing model is designed around. */
export const GRID_UNITS = 16;

/**
 * Below this width (dp) a widget drops to a single "today" box per habit instead
 * of the full 3-day strip. Mirrors iOS Small vs Medium/Large.
 */
export const THREE_DAY_MIN_WIDTH_DP = 250;

export type Grid = {
  /** Square cell size (dp/pt). */
  cell: number;
  /** Uniform spacing between cells and at the edges (each gap == each margin). */
  spacing: number;
  /** Cell corner radius. */
  cornerRadius: number;
  /** Emoji font size, sized to fit inside a cell. */
  emojiFontSize: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Even "space-evenly" spacing for `count` cells of `cellSize` along an axis of
 * `available` length: the leftover is split across the `count + 1` gaps (both
 * end margins + inner gaps), floored at MIN_GAP. Used for the horizontal grid
 * and, with the row capacity, for the vertical row spacing.
 */
export function spreadSpacing(available: number, count: number, cellSize: number): number {
  return available > 0 ? Math.max(MIN_GAP, (available - count * cellSize) / (count + 1)) : MIN_GAP;
}

/**
 * Derive the grid geometry from the available width and the number of cells that
 * sit across one habit-row (`colsEff` = icon columns + box columns across the
 * whole row, e.g. 4 for `icon+3 boxes`, 8 for two such groups).
 *
 * Cells take the compact target size (shrinking only when the width can't fit
 * `colsEff` of them plus minimum gaps); `spacing` then fills the leftover width
 * evenly across the `colsEff + 1` gaps (2 end margins + inner gaps). The result
 * is unrounded so the same formula can be shared; callers needing integer dp
 * (Android RemoteViews) should round.
 */
export function computeGrid(availableWidth: number, colsEff: number): Grid {
  const cellFit =
    availableWidth > 0
      ? Math.min(MAX_CELL, (availableWidth - (colsEff + 1) * MIN_GAP) / colsEff)
      : MAX_CELL;
  const cell = clamp(cellFit, MIN_CELL, MAX_CELL);
  const spacing = spreadSpacing(availableWidth, colsEff, cell);
  return {
    cell,
    spacing,
    cornerRadius: CORNER_RATIO * cell,
    emojiFontSize: EMOJI_SCALE * cell,
  };
}

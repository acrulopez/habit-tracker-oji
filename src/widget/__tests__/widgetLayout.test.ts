import { createMemoryKv, getKv, setKvForTesting } from "../../data/mmkv";
import {
  DEFAULT_WIDGET_LAYOUT,
  deriveLayout,
  getWidgetSize,
  setWidgetSize,
} from "../widgetLayout";

describe("deriveLayout", () => {
  test("returns the default when size is unknown", () => {
    expect(deriveLayout(null)).toEqual(DEFAULT_WIDGET_LAYOUT);
  });

  test("grows the row count with widget height", () => {
    // (110 - 28) / 44 = 1.86 -> 1 row
    expect(deriveLayout({ width: 320, height: 110 })).toMatchObject({ todayOnly: false, maxRows: 1 });
    // (160 - 28) / 44 = 3 -> 3 rows
    expect(deriveLayout({ width: 320, height: 160 })).toMatchObject({ todayOnly: false, maxRows: 3 });
    // (320 - 28) / 44 = 6.6 -> 6 rows
    expect(deriveLayout({ width: 320, height: 320 })).toMatchObject({ todayOnly: false, maxRows: 6 });
  });

  test("always renders at least one row", () => {
    expect(deriveLayout({ width: 320, height: 10 })).toMatchObject({ todayOnly: false, maxRows: 1 });
  });

  test("caps the row count for very tall widgets", () => {
    expect(deriveLayout({ width: 320, height: 1000 })).toMatchObject({ todayOnly: false, maxRows: 8 });
  });

  test("row count depends on height, not width", () => {
    expect(deriveLayout({ width: 500, height: 160 })).toMatchObject({ todayOnly: false, maxRows: 3 });
  });

  test("shows only today on a narrow widget, the full 3-day strip when wide", () => {
    // width < 250 -> today only
    expect(deriveLayout({ width: 160, height: 160 })).toMatchObject({ todayOnly: true, maxRows: 3 });
    // width >= 250 -> full strip
    expect(deriveLayout({ width: 250, height: 160 })).toMatchObject({ todayOnly: false, maxRows: 3 });
  });
});

describe("deriveLayout grid geometry", () => {
  const grid = ({
    cell,
    spacing,
    box,
    boxDone,
    cornerRadius,
    emojiFontSize,
  }: {
    cell: number;
    spacing: number;
    box: number;
    boxDone: number;
    cornerRadius: number;
    emojiFontSize: number;
  }) => ({ cell, spacing, box, boxDone, cornerRadius, emojiFontSize });

  test("keeps the compact target cell and grows spacing to fill wide widgets", () => {
    // width 500 -> colWidth 250, 4 cells per group: cell pins to MAX_CELL,
    // spacing = (250 - 4*20) / 5 = 34. Boxes draw inside the slot: undone
    // 0.75*20 = 15, done 0.875*20 = 17.5 -> 18, radius 0.28*15 = 4.2 -> 4.
    // The icon emoji is a bit bigger than a slot: 1.2*20 = 24.
    expect(deriveLayout({ width: 500, height: 160 })).toMatchObject(
      grid({ cell: 20, spacing: 34, box: 15, boxDone: 18, cornerRadius: 4, emojiFontSize: 24 }),
    );
  });

  test("clamps the cell to the minimum on a very narrow widget", () => {
    // width 60 -> today-only (4 cells across): can't fit MAX_CELL -> MIN_CELL,
    // spacing floors at MIN_GAP. Boxes: 0.75*12 = 9, 0.875*12 = 10.5 -> 11.
    // Emoji: 1.2*12 = 14.4 -> 14.
    expect(deriveLayout({ width: 60, height: 160 })).toMatchObject(
      grid({ cell: 12, spacing: 8, box: 9, boxDone: 11, cornerRadius: 3, emojiFontSize: 14 }),
    );
  });

  test("keeps spacing even and floored at the minimum gap", () => {
    // width 320 -> colWidth 160, 4 cells per group: spacing = (160 - 4*20) / 5 = 16.
    expect(deriveLayout({ width: 320, height: 160 })).toMatchObject(
      grid({ cell: 20, spacing: 16, box: 15, boxDone: 18, cornerRadius: 4, emojiFontSize: 24 }),
    );
  });

  test("the size-unknown default uses the compact grid at the minimum gap", () => {
    expect(DEFAULT_WIDGET_LAYOUT).toMatchObject(
      grid({ cell: 20, spacing: 8, box: 15, boxDone: 18, cornerRadius: 4, emojiFontSize: 24 }),
    );
  });
});

describe("deriveLayout vertical spacing", () => {
  test("sizes the gap so a full widget fills its height evenly", () => {
    // height 160 -> maxRows 3, cell 20: spacing = (160 - 3*20) / 4 = 25.
    expect(deriveLayout({ width: 320, height: 160 })).toMatchObject({ verticalSpacing: 25 });
    // Independent of width (same rows/cell): still 25.
    expect(deriveLayout({ width: 500, height: 160 })).toMatchObject({ verticalSpacing: 25 });
    // Smaller cells leave more leftover: (160 - 3*12) / 4 = 31.
    expect(deriveLayout({ width: 60, height: 160 })).toMatchObject({ verticalSpacing: 31 });
  });

  test("grows with height once the row cap is reached", () => {
    // height 1000 -> maxRows caps at 8: spacing = (1000 - 8*20) / 9 = 93.33 -> 93.
    expect(deriveLayout({ width: 320, height: 1000 })).toMatchObject({ verticalSpacing: 93 });
  });

  test("floors at the minimum gap on very short widgets", () => {
    expect(deriveLayout({ width: 320, height: 10 })).toMatchObject({ verticalSpacing: 8 });
  });

  test("the size-unknown default uses the minimum gap", () => {
    expect(DEFAULT_WIDGET_LAYOUT.verticalSpacing).toBe(8);
  });
});

describe("widget size persistence", () => {
  beforeEach(() => setKvForTesting(createMemoryKv()));
  afterEach(() => setKvForTesting(null));

  test("returns null when nothing is stored", () => {
    expect(getWidgetSize()).toBeNull();
  });

  test("round-trips a stored size", () => {
    setWidgetSize({ width: 300, height: 250 });
    expect(getWidgetSize()).toEqual({ width: 300, height: 250 });
  });

  test("returns null for malformed stored JSON", () => {
    getKv().set("widgetSize", "{not json");
    expect(getWidgetSize()).toBeNull();
  });
});

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
    expect(deriveLayout({ width: 320, height: 110 })).toEqual({ todayOnly: false, maxRows: 1 });
    // (160 - 28) / 44 = 3 -> 3 rows
    expect(deriveLayout({ width: 320, height: 160 })).toEqual({ todayOnly: false, maxRows: 3 });
    // (320 - 28) / 44 = 6.6 -> 6 rows
    expect(deriveLayout({ width: 320, height: 320 })).toEqual({ todayOnly: false, maxRows: 6 });
  });

  test("always renders at least one row", () => {
    expect(deriveLayout({ width: 320, height: 10 })).toEqual({ todayOnly: false, maxRows: 1 });
  });

  test("caps the row count for very tall widgets", () => {
    expect(deriveLayout({ width: 320, height: 1000 })).toEqual({ todayOnly: false, maxRows: 8 });
  });

  test("row count depends on height, not width", () => {
    expect(deriveLayout({ width: 500, height: 160 })).toEqual({ todayOnly: false, maxRows: 3 });
  });

  test("shows only today on a narrow widget, the full 3-day strip when wide", () => {
    // width < 250 -> today only
    expect(deriveLayout({ width: 160, height: 160 })).toEqual({ todayOnly: true, maxRows: 3 });
    // width >= 250 -> full strip
    expect(deriveLayout({ width: 250, height: 160 })).toEqual({ todayOnly: false, maxRows: 3 });
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

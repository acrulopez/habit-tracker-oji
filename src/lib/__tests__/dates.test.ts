import {
  addDays,
  dateKeyToOffset,
  diffDays,
  offsetToDateKey,
  parseDateKey,
  relativeTimeFromNow,
  toDateKey,
  todayKey,
} from "../dates";

describe("dates", () => {
  test("toDateKey formats local date as YYYY-MM-DD with padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  test("todayKey matches toDateKey of now", () => {
    const now = new Date(2026, 5, 28);
    expect(todayKey(now)).toBe("2026-06-28");
  });

  test("parseDateKey round-trips", () => {
    expect(toDateKey(parseDateKey("2026-06-28"))).toBe("2026-06-28");
  });

  test("addDays handles month and year boundaries", () => {
    expect(addDays("2026-06-28", 1)).toBe("2026-06-29");
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("diffDays counts whole days", () => {
    expect(diffDays("2026-06-28", "2026-06-27")).toBe(1);
    expect(diffDays("2026-06-28", "2026-06-28")).toBe(0);
    expect(diffDays("2026-07-01", "2026-06-28")).toBe(3);
  });

  test("dateKeyToOffset / offsetToDateKey round-trip", () => {
    expect(dateKeyToOffset("2020-01-01")).toBe(0);
    for (const key of ["2020-01-01", "2020-12-31", "2026-07-04", "2019-06-15"]) {
      expect(offsetToDateKey(dateKeyToOffset(key))).toBe(key);
    }
  });

  test("relativeTimeFromNow bins the elapsed time", () => {
    const now = new Date("2026-07-04T12:00:00.000Z");
    const iso = (min: number) =>
      new Date(now.getTime() - min * 60_000).toISOString();
    expect(relativeTimeFromNow(iso(0), now)).toBe("just now");
    expect(relativeTimeFromNow(iso(5), now)).toBe("5 min ago");
    expect(relativeTimeFromNow(iso(60), now)).toBe("1 hr ago");
    expect(relativeTimeFromNow(iso(180), now)).toBe("3 hrs ago");
    expect(relativeTimeFromNow(iso(60 * 48), now)).toBe("2 days ago");
  });
});

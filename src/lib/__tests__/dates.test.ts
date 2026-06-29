import { addDays, diffDays, parseDateKey, toDateKey, todayKey } from "../dates";

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
});

import { currentStreak, longestStreak, totalCompletions } from "../streaks";

describe("streaks", () => {
  const today = "2026-06-28";

  test("currentStreak counts consecutive days ending today", () => {
    expect(
      currentStreak(["2026-06-26", "2026-06-27", "2026-06-28"], today),
    ).toBe(3);
  });

  test("currentStreak counts back from yesterday when today not done", () => {
    expect(currentStreak(["2026-06-26", "2026-06-27"], today)).toBe(2);
  });

  test("currentStreak is 0 when neither today nor yesterday done", () => {
    expect(currentStreak(["2026-06-20"], today)).toBe(0);
  });

  test("currentStreak stops at gaps", () => {
    expect(
      currentStreak(["2026-06-24", "2026-06-27", "2026-06-28"], today),
    ).toBe(2);
  });

  test("longestStreak finds the longest run anywhere", () => {
    expect(
      longestStreak([
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-10",
        "2026-06-11",
      ]),
    ).toBe(3);
  });

  test("longestStreak handles empty and single", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2026-06-01"])).toBe(1);
  });

  test("totalCompletions de-duplicates", () => {
    expect(totalCompletions(["2026-06-01", "2026-06-01", "2026-06-02"])).toBe(2);
  });
});

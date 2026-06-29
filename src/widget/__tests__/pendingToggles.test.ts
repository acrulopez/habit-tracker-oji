import { parsePendingToggles } from "../pendingToggles";

describe("parsePendingToggles", () => {
  test("returns [] for empty / null / undefined input", () => {
    expect(parsePendingToggles(null)).toEqual([]);
    expect(parsePendingToggles(undefined)).toEqual([]);
    expect(parsePendingToggles("")).toEqual([]);
  });

  test("returns [] for malformed JSON", () => {
    expect(parsePendingToggles("{not json")).toEqual([]);
  });

  test("returns [] when the payload isn't an array", () => {
    expect(parsePendingToggles('{"habitId":"a"}')).toEqual([]);
  });

  test("parses compact JSON with boolean done", () => {
    const raw = '[{"habitId":"a","date":"2026-06-28","done":true}]';
    expect(parsePendingToggles(raw)).toEqual([
      { habitId: "a", date: "2026-06-28", done: true },
    ]);
  });

  test("parses pretty-printed JSON (ExtensionStorage.get Data path)", () => {
    const raw = `[
      {
        "habitId" : "a",
        "date" : "2026-06-28",
        "done" : false
      }
    ]`;
    expect(parsePendingToggles(raw)).toEqual([
      { habitId: "a", date: "2026-06-28", done: false },
    ]);
  });

  test("coerces done from string and number representations", () => {
    const raw =
      '[{"habitId":"a","date":"2026-06-28","done":1},' +
      '{"habitId":"b","date":"2026-06-28","done":"true"},' +
      '{"habitId":"c","date":"2026-06-28","done":0},' +
      '{"habitId":"d","date":"2026-06-28","done":"false"}]';
    expect(parsePendingToggles(raw)).toEqual([
      { habitId: "a", date: "2026-06-28", done: true },
      { habitId: "b", date: "2026-06-28", done: true },
      { habitId: "c", date: "2026-06-28", done: false },
      { habitId: "d", date: "2026-06-28", done: false },
    ]);
  });

  test("skips entries missing habitId or date", () => {
    const raw =
      '[{"date":"2026-06-28","done":true},' +
      '{"habitId":"b","done":true},' +
      '{"habitId":"c","date":"2026-06-28","done":true}]';
    expect(parsePendingToggles(raw)).toEqual([
      { habitId: "c", date: "2026-06-28", done: true },
    ]);
  });
});

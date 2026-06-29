import type { PendingToggle } from "../data/types";

/**
 * Parse the iOS widget's pending-toggle queue.
 *
 * Contract with the native side (targets/widget/index.swift): the queue is a
 * JSON array of `{ habitId: string, date: "YYYY-MM-DD", done: bool }`, written
 * into App Group UserDefaults as a JSON *string*. `ExtensionStorage.get()` may
 * return that string either verbatim (compact) or re-serialized (pretty-printed)
 * depending on how the value was stored, so we must tolerate both — and we must
 * not assume `done` is a real JS boolean. This function is intentionally
 * defensive and pure so it can be unit-tested without the native bridge.
 */
export function parsePendingToggles(
  raw: string | null | undefined,
): PendingToggle[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const result: PendingToggle[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    if (typeof t.habitId !== "string" || typeof t.date !== "string") continue;
    result.push({
      habitId: t.habitId,
      date: t.date,
      done: coerceBool(t.done),
    });
  }
  return result;
}

function coerceBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

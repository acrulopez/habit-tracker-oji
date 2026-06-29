// All date keys are LOCAL calendar dates formatted as "YYYY-MM-DD".
// We intentionally avoid UTC/ISO slicing so a completion is attributed to the
// user's local day, not the UTC day.

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a Date as a local "YYYY-MM-DD" key. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local date key. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Parse a "YYYY-MM-DD" key into a local Date (at midnight). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

/** Return a new key offset by `days` from the given key. */
export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole-day difference a - b (both keys), e.g. diffDays(today, yesterday) === 1. */
export function diffDays(a: string, b: string): number {
  const ms = parseDateKey(a).getTime() - parseDateKey(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** The last `n` local date keys ending today, oldest first. */
export function lastNDays(n: number, today: string = todayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** Single-letter weekday for a date key (local). */
export function weekdayInitial(key: string): string {
  return WEEKDAY_INITIALS[parseDateKey(key).getDay()];
}

/** Short relative label for recent days: "Today", "Yest.", else weekday initial. */
export function recentDayLabel(key: string, today: string = todayKey()): string {
  const delta = diffDays(today, key);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yest.";
  return weekdayInitial(key);
}

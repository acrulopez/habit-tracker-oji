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

// Fixed epoch for compact completion encoding in cloud backups. Completion
// dates are stored as integer day-offsets from this key (~4 bytes vs ~12 for a
// "YYYY-MM-DD" string), giving several times more headroom under the 1 MB
// iCloud key-value store cap. Must never change once data is in the wild.
const BACKUP_EPOCH = "2020-01-01";

/** Day-offset of a date key from the backup epoch (for compact encoding). */
export function dateKeyToOffset(key: string): number {
  return diffDays(key, BACKUP_EPOCH);
}

/** Inverse of dateKeyToOffset: rebuild a date key from a day-offset. */
export function offsetToDateKey(offset: number): string {
  return addDays(BACKUP_EPOCH, offset);
}

/** Coarse "x min/hr/day ago" label for a timestamp (used by Settings). */
export function relativeTimeFromNow(iso: string, now: Date = new Date()): string {
  const secs = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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

import { addDays, todayKey } from "./dates";

/**
 * Current streak = number of consecutive completed days ending today (if today
 * is done) or ending yesterday (if today is not yet done). This keeps the
 * streak from breaking just because the user hasn't checked in yet today.
 */
export function currentStreak(
  dates: Iterable<string>,
  today: string = todayKey(),
): number {
  const set = dates instanceof Set ? dates : new Set(dates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive completed days in the whole history. */
export function longestStreak(dates: Iterable<string>): number {
  const sorted = Array.from(new Set(dates)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && addDays(prev, 1) === d) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

export function totalCompletions(dates: Iterable<string>): number {
  return new Set(dates).size;
}

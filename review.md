# Code Review — habit-tracker-oji

Reviewer: senior RN/Expo engineer. Focus: correctness, the iOS Swift ⟷ JS data
contract, state/race issues, Expo Router/React pitfalls, robustness.

Scope note: `tsc`, `jest`, `expo export`, `expo prebuild`, and `expo-doctor` are
reported green; this review targets behavior those checks cannot exercise —
above all the native iOS widget data channel, which is never run by the tests.

---

## Critical

### C1. iOS reconcile drops `done=false` undos coming from the widget
`src/widget/reconcile.ts:34-37`

```ts
for (const toggle of pending) {
  if (toggle?.habitId && toggle?.date) {
    habitRepository.setCompletion(toggle.habitId, toggle.date, !!toggle.done);
  }
}
```

The guard itself is fine (it checks `habitId`/`date`, not `done`). The real
problem is upstream, in how `done` survives the Swift→JS channel. Trace it:

1. The widget intent writes the pending queue with `JSONSerialization`
   (`targets/widget/index.swift:57-61`) — `["done": done]` where `done` is a
   Swift `Bool`. `JSONSerialization.data` serializes a Swift `Bool` as the JSON
   literals `true`/`false`. So far so good.
2. But the queue is stored via `defaults.set(str, forKey:)` where `str` is a
   **String** (line 60). So in UserDefaults the value is a `String`, not `Data`.
3. JS reads via `storage.get(PENDING_TOGGLES_KEY)`. The native `get`
   (`node_modules/@bacons/apple-targets/ios/ExtensionStorageModule.swift:63-79`)
   **first tries `userDefaults?.data(forKey: key)`**. Because the value was
   stored as a `String`, `data(forKey:)` returns `nil`, so it falls through to
   `object(forKey:)` and returns `String(describing: value)`.

For a stored `String`, `String(describing:)` returns the string verbatim, so
the JSON text is preserved and `JSON.parse` succeeds — `done` is a real boolean.
**This path happens to work**, but only by luck of `String(describing:)` on a
`String`. It is extremely fragile and undocumented. See C2 for the place where
the same get-semantics actually breaks.

**Why it's risky:** the contract relies on `get()` returning the raw string for
String-typed values and pretty-printed JSON for Data-typed values. Any future
change to how the queue is written (e.g. writing it as an array via
`setArray`, or the library normalizing storage to `Data`) silently changes what
JS parses. The boolean channel has no schema validation on the JS side beyond
`!!toggle.done`.

**Fix:** make the JS side defensive and explicit about types, and prefer a
single, documented storage representation. At minimum coerce robustly:

```ts
const done = toggle.done === true || toggle.done === "true" || toggle.done === 1;
habitRepository.setCompletion(toggle.habitId, toggle.date, done);
```

and add a date-equality guard (see C3).

### C2. `ExtensionStorage.get()` pretty-prints JSON, but reconcile assumes the raw string — and the snapshot read path is inconsistent with it
`node_modules/@bacons/apple-targets/ios/ExtensionStorageModule.swift:63-79`,
`src/widget/syncWidget.tsx:25-27`, `src/widget/reconcile.ts:20`

The native `get()` has two completely different return shapes depending on
whether the underlying value is `Data` or a `String`:

- If stored as **`Data`** (i.e. written by `setObject`/`setArray`): `get`
  decodes it and **re-serializes with `.prettyPrinted`**, returning multi-line
  JSON with spaces/newlines.
- If stored as **`String`** (i.e. written by `setString`): `get` returns
  `String(describing:)` of the string — the raw compact JSON.

Now look at what the app writes:

- Snapshot: `storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot))` →
  `value` is a **string** → `setString` → stored as **String**
  (`syncWidget.tsx:26`).
- The Swift widget reads the snapshot with `defaults.string(forKey:)`
  (`index.swift:30`), which only succeeds for String-typed values. ✅ consistent.

So the snapshot round-trips fine **today**. But this couples correctness to the
fact that `ExtensionStorage.set` dispatches strings to `setString`. If anyone
ever passes the object directly (`storage.set(SNAPSHOT_KEY, snapshot)` instead
of `JSON.stringify(...)`), `set` routes it to `setObject`, it gets stored as
**Data**, and:

1. The Swift widget's `defaults.string(forKey:)` returns `nil` (it's Data now),
   so `readSnapshotString` falls back to `data(forKey:)` — that branch exists
   (`index.swift:31`) and would still decode. OK there.
2. But `reconcileWidgetToggles` reading the **pending** key would then get
   **pretty-printed** JSON from `get()`. `JSON.parse` tolerates whitespace, so
   parsing still works — the danger is values like booleans/numbers, which
   `JSONSerialization` round-trips faithfully, so parsing is fine.

Net: the code works **only** because the snapshot is written as a `JSON.stringify`
string and the pending queue is written by Swift as a String. This is a
load-bearing implicit contract with zero tests and zero runtime assertions.

**Fix:** Document the contract explicitly at both ends, and harden the JS
parse to tolerate both compact and pretty-printed JSON (it already does via
`JSON.parse`) AND non-array / object-shaped returns. Most importantly, add a
unit/integration test that feeds reconcile a pretty-printed string to lock the
behavior. Consider standardizing on `setArray` for the pending queue so both
sides use the `Data`+JSON path consistently, then the Swift `appendPendingToggle`
must also write via `JSONSerialization` as Data (it currently writes a String).

### C3. Stale-day pending toggles are applied to the wrong logic and snapshot date can drift across midnight
`targets/widget/index.swift:83`, `src/widget/reconcile.ts:34-37`,
`src/widget/snapshot.ts:9`

The widget timeline policy is `.never` (`index.swift:108`), so the snapshot the
widget renders is only ever refreshed when the **app** calls `syncWidget()`.
The snapshot carries a fixed `date` field (`snapshot.ts:9`, written at app
foreground/mutation time). After midnight, with the app closed, the widget still
shows yesterday's snapshot with `snapshot.date == "yesterday"`.

When the user taps the widget after midnight:
- The intent toggles `snapshot.habits[idx].done` and appends a pending toggle
  with `date: snapshot.date` = **yesterday** (`index.swift:83`).
- On next foreground, `reconcile` applies that toggle to **yesterday's**
  completion (`reconcile.ts:36`), not today's. The user intended to complete
  *today*, but the widget's notion of "today" is stale.

This is a real, silent data-correctness bug: completions land on the wrong day.

**Why it happens:** the widget has no live clock relative to the stored snapshot
date, and the timeline never refreshes itself.

**Fix options (pick one):**
- In `reconcile`, ignore/translate pending toggles whose `date !== todayKey()`
  (drop stale ones, or — safer — still apply to the date they claim, but ALSO
  the widget should compute "today" itself). The cleanest is to have the App
  Intent recompute the date with `WidgetHabit`-side logic, but App Intents don't
  have the app's `todayKey`. Practical mitigation: add a timeline refresh at the
  start of the next day. Use `Timeline(entries:..., policy: .after(nextMidnight))`
  so WidgetKit re-pulls (and the entry's logic can mark the snapshot stale), or
  show a "tap to refresh in app" state when `snapshot.date != todayLocal`.
- At minimum: in `reconcile.ts`, compare `toggle.date` to `todayKey()` and skip
  (or surface) stale-day toggles to avoid silently mutating yesterday.

---

## Major

### M1. iOS widget toggle while the app is open → snapshot overwrite / lost update race
`src/store/useHabitStore.ts:78-82`, `src/widget/reconcile.ts:31-41`,
`app/_layout.tsx:14-21`

Sequence when the app is foregrounded:
1. User taps a habit in the app → `toggleToday` writes MMKV and calls
   `syncWidget()` which republishes the snapshot.
2. Independently, an iOS widget tap fires the App Intent (it can run while the
   app is in the foreground). It reads the *current* App Group snapshot, toggles
   it, **writes the snapshot back**, and appends to the pending queue.
3. The app's `syncWidget()` from step 1 may run *after* step 2's write, clobbering
   the widget's toggled snapshot with the app's view — or vice versa.

Reconcile only runs on `AppState === "active"` transitions
(`_layout.tsx:16-20`). A widget tap while the app is *already* active does **not**
trigger reconcile, so the pending toggle sits in the queue and the in-app UI
won't reflect it until the next background→foreground cycle. Meanwhile the
snapshot can be overwritten by either side. There is no locking or sequence
number on the shared snapshot.

**Why it's wrong:** classic read-modify-write race over shared UserDefaults with
two writers (app + intent) and no coordination. Symptoms: a widget tap appears
to "not stick", or double-counts after reconcile re-applies a toggle the app
already reflected.

**Fix:** The reconcile model already de-risks double-application because it uses
`setCompletion(..., absolute bool)` not a toggle — re-applying the same absolute
state is idempotent (good). The remaining gaps:
- Run reconcile more eagerly. Since App Intents can't ping the app directly,
  consider draining the queue inside `syncWidget()`/`refresh()` and also when the
  Home screen regains focus, not only on AppState active.
- Treat the pending queue as the source of truth for widget-originated changes and
  always reconcile-before-publish: in `refresh()` you already call
  `reconcileWidgetToggles()` then `syncWidget()` — but `toggleToday`/`reorder`
  call `syncWidget()` **without** reconciling first (`useHabitStore.ts:75,81`), so
  an in-app mutation can publish a snapshot that silently discards a queued widget
  toggle. Reconcile (or at least merge the queue) before every publish.

### M2. `reconcile` clears the queue before applying it — a crash mid-loop loses toggles
`src/widget/reconcile.ts:31-38`

```ts
storage.remove(PENDING_TOGGLES_KEY);
if (pending.length === 0) return false;
for (const toggle of pending) { ... habitRepository.setCompletion(...) }
```

The queue is removed *before* the toggles are applied. If `setCompletion` throws
for any entry (or the JS thread is killed between the `remove` and the loop
completing), those pending toggles are gone forever — the widget tap is silently
lost. Also, a new widget tap that lands *between* `get` and `remove` is dropped
(read-then-clear is not atomic with the writer).

**Fix:** apply first, then remove only the entries you actually consumed; or
snapshot the queue, apply, then remove only if all applied. Better: write back
the un-consumed tail rather than blindly `remove`. Given idempotent
`setCompletion`, applying-then-removing is safe against double application.

### M3. App Intent silently no-ops if the snapshot is missing or stale
`targets/widget/index.swift:75-87`

```swift
guard let defaults = sharedDefaults(), var snapshot = loadSnapshot() else {
  return .result()
}
if let idx = snapshot.habits.firstIndex(where: { $0.id == habitId }) { ... }
```

If `loadSnapshot()` returns `nil` (no snapshot written yet, decode failure, or
the app cleared it), the tap does nothing — no pending toggle is queued, so the
completion is lost with no feedback. Likewise if the tapped `habitId` isn't in
the snapshot (deleted in-app since last publish), the tap is a silent no-op.

**Why it matters:** on a fresh install where the user adds the widget before
ever opening the app, or after a habit is deleted, taps vanish.

**Fix:** when the snapshot is missing, still queue the pending toggle keyed by
`habitId` and a date computed in-intent (note C3's date concern), so reconcile
can apply it. Or render a "Open app" placeholder when no snapshot exists so the
user isn't tapping into the void.

### M4. Android headless toggle uses `todayKey()` from a possibly-stale JS runtime; no snapshot/date coordination with app
`src/widget/widgetTaskHandler.tsx:16-23`, `index.js:6-10`

The Android handler toggles MMKV directly with `todayKey()` computed at tap time
in the headless task — that's actually correct for "today" (good, no stale
snapshot problem like iOS). But two concerns:

1. The handler calls `habitRepository.toggleCompletion` (a relative toggle), not
   an absolute set. If the widget's rendered state and MMKV ever disagree (e.g.
   the app changed completion while the widget RemoteViews showed the old state),
   tapping toggles relative to MMKV, which may flip the *opposite* way from what
   the user sees on the widget. iOS uses absolute `setCompletion` and is safer.
2. After toggling, it re-renders from `buildTodaySnapshot()` which re-reads MMKV
   — fine. But if the app is foregrounded simultaneously, both the app and the
   headless task mutate the same MMKV instance from different JS contexts. MMKV
   is process-safe for reads/writes, but the **app's in-memory Zustand
   `todayDone`** won't know about the headless write until the next `refresh()`
   (only on AppState active). So the on-screen list can be stale relative to the
   widget. Acceptable, but worth noting.

**Fix:** Have the Android handler render the optimistic state it just wrote
(it does), and ensure the app's `refresh()` re-reads on focus (it does on
AppState active). Consider switching the widget tap to compute the desired
absolute state to match iOS semantics. Low risk; leave if intentional.

### M5. `toggleToday` / `reorder` publish a snapshot without reconciling first
`src/store/useHabitStore.ts:68-82`

`reorder` and `toggleToday` call `syncWidget()` directly. `syncWidget` rebuilds
the snapshot from MMKV and publishes. If there are un-drained widget toggles in
the iOS pending queue, this publish reflects MMKV (which doesn't yet include
those queued toggles) and the widget visually reverts the user's widget tap
until the next reconcile. See M1. Combine the fix.

### M6. Reorder optimistic update can desync `order` vs displayed list on partial id sets
`src/store/useHabitStore.ts:68-76`, `src/data/habitRepository.ts:98-105`

`reorder` maps `orderedIds` through the current `habits` and drops any id not
found (`filter Boolean`). `reorderHabits` in the repo assigns `position.get(h.id)
?? h.order`. If `orderedIds` is ever a subset of all habits (shouldn't happen via
`DraggableFlatList`, which passes the full `data`), persisted orders and the
optimistic state diverge. Currently safe because the source list is always the
full set, but the two code paths compute order independently (store rebuilds the
array by id order; repo assigns numeric `order` by index). They agree only as
long as the input is the complete, current set. Minor fragility; consider having
the store derive its optimistic `habits` from the same `position` map the repo
uses, or just call `refresh()` after reorder for a single source of truth.

---

## Minor

### m1. `diffDays` is dead code
`src/lib/dates.ts:33-36`. Exported and unit-tested but unused by app/streak
logic (`currentStreak`/`longestStreak` use `addDays` + set membership). Keep if
intended as public API; otherwise remove to reduce surface.

### m2. `theme.done` is unused
`src/theme/theme.ts:14,28,42`. Defined in both palettes, never read. Dead field.

### m3. `Theme` import of `diffDays`/`parseDateKey` etc. — `parseDateKey` only used internally
Fine, but `parseDateKey` is exported and only used within `dates.ts` + tests.
Cosmetic.

### m4. `EmojiPicker` (rn-emoji-keyboard) renders even when `open=false`
`src/components/EmojiPickerField.tsx:29-37`. The picker is always mounted with
`open={open}`. That's the library's intended usage (it manages its own modal),
so OK — just confirm it doesn't capture touches when closed. No action needed.

### m5. History screen reads completions directly from the repository, bypassing the store
`app/habit/[id]/history.tsx:6,27`. It uses `habitRepository.getCompletions(id)`
via `useFocusEffect`, which is fine and refreshes on focus, but means widget/app
toggles to *today* are only reflected when the screen refocuses. Acceptable for a
history view. The `habit` name/emoji come from the store
(`useHabitStore(... habits.find)`) — consistent.

### m6. `updatePeriodMillis: 0` for the Android widget
`app.config.ts:71`. Means no periodic refresh — fine since the app pushes updates
and taps re-render via the headless task. But the Android widget shows whatever
was last rendered; after a date rollover with the app closed, the "done" ticks
reflect yesterday until the next tap or app open. Mirror of C3 but lower impact
because the Android tap recomputes `todayKey()` and toggles today correctly. Note
that the *displayed* checkmarks can be a day stale until re-render.

### m7. `fallbackUuid` is non-cryptographic and only RFC4122-ish
`src/lib/id.ts:3-10`. Fine as a fallback; `Crypto.randomUUID()` is the primary
path on device. No action.

### m8. No `app.json`; config is `app.config.ts` only
Confirmed (`app.config.ts` present, no `app.json`). `src/config.ts` mirrors via
`expo-constants extra`. Consistent. Good. Just remember `extra` is read from the
embedded manifest — values are baked at build time, which is correct here.

### m9. `HabitsWidget.tsx` (Android) uses `snapshot?.habits ?? []` but prop type is non-optional
`src/widget/HabitsWidget.tsx:8-9`. Defensive `?.` against a non-nullable
`TodaySnapshot` prop — harmless, slightly inconsistent with the type. Fine.

### m10. Snapshot caps at 6 habits on both platforms
`index.swift:136` (`prefix(6)`), `HabitsWidget.tsx:5,30` (`MAX_ROWS=6`). Habits
beyond the 6th can't be toggled from the widget. Intentional given widget size,
but worth a product note. The full snapshot is still written (all habits), so
reconcile is unaffected.

---

## What's correct / good — do NOT change

- **Local-date handling is right.** `dates.ts` deliberately uses
  `getFullYear/getMonth/getDate` (local) instead of UTC ISO slicing, so
  completions attribute to the user's local day. Round-trips and boundary tests
  pass. (`src/lib/dates.ts:10-30`)
- **Streak math is correct, including the "don't break the streak before today's
  check-in" rule.** `currentStreak` starts at today if done else yesterday, then
  walks backward over a `Set` — handles gaps and the not-yet-checked-in case.
  `longestStreak` sorts+dedupes and tracks the best run. Edge cases (empty,
  single) covered. (`src/lib/streaks.ts`)
- **Reconcile uses absolute `setCompletion`, not a relative toggle**, making
  re-application idempotent — this is the key design choice that prevents
  double-counting when a queued toggle is applied and then a snapshot republish
  happens. (`reconcile.ts:36`, `habitRepository.ts:116-121`) Good.
- **The repository abstraction is clean** and is the single seam for future
  cloud sync. UI and widgets only talk to it, never MMKV directly. Completions
  stored sorted+deduped. Delete also clears completions. (`habitRepository.ts`)
- **MMKV App Group setup** via `infoPlist.AppGroup` so the store lives in the
  shared container, plus the entitlement, is correct for sharing with the
  extension later. (`app.config.ts:23-29`, `mmkv.ts:13-23`)
- **Config single-source-of-truth** with `app.config.ts` → `extra` → `config.ts`,
  plus the App Group / kind / key strings all matching across `app.config.ts`,
  `config.ts`, `index.swift`, and `expo-target.config.js`:
  - App Group: `group.dev.alejandrodelacruz.habittracker` ✅ (config.ts derives,
    swift hardcodes the same)
  - iOS widget kind: `"HabitsWidget"` matches `index.swift:156` `kind`,
    `expo-target.config.js:5` `name`, `config.ts:18`. ✅
  - Android widget name: `"Habits"` matches `app.config.ts:63` and
    `config.ts:19`. ✅
  - Keys `"todaySnapshot"` / `"pendingToggles"` match between `config.ts:22-23`
    and `index.swift:7-8`. ✅
- **Android headless registration happens before app boot** in `index.js`, so
  taps are handled when the app is closed. Platform-guarded `require` keeps it
  off iOS. (`index.js:6-10`)
- **`syncWidget` lazy-requires `react-native-android-widget`** only on Android,
  keeping the native dep off the iOS evaluation path. (`syncWidget.tsx:32-33`)
- **JSON parse failures are handled** throughout the repo (`readHabits`,
  `readCompletions`) and in reconcile (try/catch → empty array). Robust against
  corrupt MMKV. (`habitRepository.ts:26-31,41-45`, `reconcile.ts:24-29`)
- **Zustand selectors are used correctly** — components subscribe to narrow
  slices (`s.habits`, `s.todayDone`, individual actions), avoiding broad
  re-renders. `editHabit`/`history` select via `habits.find`, which re-renders
  only when `habits` changes. (`app/index.tsx:21-25`, `edit.tsx:11`,
  `history.tsx:21`)
- **The `done` boolean survives the JSON-string channel** in both directions:
  app writes `JSON.stringify({done: boolean})`, Swift `JSONDecoder` → `Bool`;
  Swift writes `Bool` via `JSONSerialization` → `true/false`, JS `JSON.parse` →
  boolean. No 0/1 vs true/false mismatch in the current code paths. (Just keep
  the defensive coercion suggested in C1 to lock it in.)
- **Reanimated/worklets babel plugin is last**, as required for Reanimated 4.
  (`babel.config.js:5-7`)
- **`AppState` listener cleanup** is correct (`sub.remove()` in the effect
  cleanup), and `refresh` is a stable Zustand action so the effect dep is safe.
  (`_layout.tsx:14-21`)
- **`GestureHandlerRootView` + `SafeAreaProvider`** wrap the tree correctly for
  `react-native-draggable-flatlist`. (`_layout.tsx:24-25`)
- **Modal presentation** for new/edit and standard push for history is set up
  correctly in the Stack. (`_layout.tsx:34-39`)

---

## Suggested priority order
1. **C3** (wrong-day completions after midnight) — silent data corruption.
2. **C1/C2** (lock down the Swift⟷JS contract + add a reconcile test feeding
   pretty-printed/compact JSON and boolean coercion).
3. **M1/M2/M5** (race + queue-clear-before-apply + reconcile-before-publish) —
   make `reconcile` apply-then-remove, and reconcile before every iOS publish.
4. **M3** (queue toggles even when snapshot missing; placeholder for empty).
5. Minors as cleanup.

---

## Fixes applied (post-review)

- **C3 — fixed.** The iOS App Intent now computes `localTodayKey()` itself and
  queues the pending toggle with *today's* date; a stale (previous-day) snapshot
  is reset (all habits → not-done for today) before toggling. The timeline now
  reloads at the next local midnight (`policy: .after(startOfNextDay())`) and the
  provider presents stale snapshots as not-done, so checkmarks never show the
  wrong day. (`targets/widget/index.swift`)
- **C1/C2 — fixed.** Extracted `parsePendingToggles()` into a pure module with
  defensive `done` coercion (`true`/`"true"`/`1`/`"1"`) that tolerates compact
  and pretty-printed JSON, plus a 7-case unit test
  (`src/widget/pendingToggles.ts`, `src/widget/__tests__/pendingToggles.test.ts`).
- **M2 — fixed.** `reconcile` now applies all toggles *then* clears the queue
  (apply-then-remove), so a crash mid-loop can't lose taps. (`src/widget/reconcile.ts`)
- **M1/M5 — fixed.** `toggleToday` and `reorder` now `reconcileWidgetToggles()`
  before publishing, and recompute `todayDone` from MMKV, so an in-app mutation
  no longer republishes a snapshot that discards queued widget toggles.
  (`src/store/useHabitStore.ts`)
- **m2 — fixed.** Removed the unused `theme.done` field. (`src/theme/theme.ts`)
- **M3 — partially addressed.** The App Intent still records a pending toggle
  even when the habit isn't in the snapshot; note the widget only renders buttons
  for habits present in the snapshot, so the "missing snapshot → silent no-op"
  path isn't reachable from a tap (no buttons are shown).
- **M4 — left as-is (intentional).** The Android headless tap computes
  `todayKey()` at tap time (correct day) and toggles relative to MMKV truth,
  which matches what the freshly-re-rendered widget shows.
- **M6 — left as-is.** Safe because `DraggableFlatList` always passes the full
  habit set; `reorder` now also recomputes `todayDone` for consistency.
- **Minors m1/m6/m10** — noted, no behavior change (m10 6-habit widget cap is a
  product decision; full snapshot is still written so reconcile is unaffected).

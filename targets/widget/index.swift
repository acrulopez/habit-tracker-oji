import WidgetKit
import SwiftUI
import AppIntents

// Must match APP_GROUP / keys in src/config.ts and WIDGET_DAYS in snapshot.ts.
private let APP_GROUP = "group.dev.alejandrodelacruz.habittracker"
private let SNAPSHOT_KEY = "todaySnapshot"
private let PENDING_KEY = "pendingToggles"
private let WIDGET_DAYS = 3

// MARK: - Shared data model (mirrors src/data/types.ts)

struct WidgetDay: Codable {
    let date: String
    var done: Bool
}

struct WidgetHabit: Codable, Identifiable {
    let id: String
    let name: String
    let emoji: String
    var days: [WidgetDay]
}

struct TodaySnapshot: Codable {
    var date: String
    var habits: [WidgetHabit]
}

private func sharedDefaults() -> UserDefaults? {
    UserDefaults(suiteName: APP_GROUP)
}

// MARK: - Local date helpers (must match src/lib/dates.ts — local calendar day)

private func dateKeyFormatter() -> DateFormatter {
    let f = DateFormatter()
    f.calendar = Calendar.current
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd"
    return f
}

private func localTodayKey() -> String {
    dateKeyFormatter().string(from: Date())
}

// Recent day keys, oldest first (e.g. [-2, -1, today]).
private func recentDateKeys() -> [String] {
    let calendar = Calendar.current
    let formatter = dateKeyFormatter()
    let start = calendar.startOfDay(for: Date())
    var keys: [String] = []
    for i in stride(from: WIDGET_DAYS - 1, through: 0, by: -1) {
        if let day = calendar.date(byAdding: .day, value: -i, to: start) {
            keys.append(formatter.string(from: day))
        }
    }
    return keys
}

// MARK: - Snapshot read/write

private func readSnapshotString(_ defaults: UserDefaults) -> String? {
    if let s = defaults.string(forKey: SNAPSHOT_KEY) { return s }
    if let d = defaults.data(forKey: SNAPSHOT_KEY) { return String(data: d, encoding: .utf8) }
    return nil
}

private func loadSnapshot() -> TodaySnapshot? {
    guard let defaults = sharedDefaults(),
          let raw = readSnapshotString(defaults),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
}

private func writeSnapshot(_ snapshot: TodaySnapshot, into defaults: UserDefaults) {
    if let data = try? JSONEncoder().encode(snapshot),
       let str = String(data: data, encoding: .utf8) {
        defaults.set(str, forKey: SNAPSHOT_KEY)
    }
}

// Look up a habit's done state for a date in the snapshot (default false). This
// is keyed purely by date string, so a stale (previous-day) snapshot naturally
// resolves to "not done" for the new day's keys.
private func doneFor(_ snapshot: TodaySnapshot?, habitId: String, date: String) -> Bool {
    guard let habit = snapshot?.habits.first(where: { $0.id == habitId }) else { return false }
    return habit.days.first(where: { $0.date == date })?.done ?? false
}

// Build the habits to display, with each habit's days normalized to the current
// recent date keys.
private func displayHabits(_ snapshot: TodaySnapshot?, dateKeys: [String]) -> [WidgetHabit] {
    guard let snapshot = snapshot else { return [] }
    return snapshot.habits.map { habit in
        WidgetHabit(
            id: habit.id,
            name: habit.name,
            emoji: habit.emoji,
            days: dateKeys.map { WidgetDay(date: $0, done: doneFor(snapshot, habitId: habit.id, date: $0)) }
        )
    }
}

private func appendPendingToggle(habitId: String, date: String, done: Bool, into defaults: UserDefaults) {
    var pending: [[String: Any]] = []
    if let raw = defaults.string(forKey: PENDING_KEY),
       let data = raw.data(using: .utf8),
       let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
        pending = arr
    }
    pending.append(["habitId": habitId, "date": date, "done": done])
    if let data = try? JSONSerialization.data(withJSONObject: pending),
       let str = String(data: data, encoding: .utf8) {
        defaults.set(str, forKey: PENDING_KEY)
    }
}

private func startOfNextDay() -> Date {
    let calendar = Calendar.current
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date().addingTimeInterval(86400)
    return calendar.startOfDay(for: tomorrow)
}

// MARK: - Interactive toggle intent (iOS 17+)

struct ToggleHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Habit"

    @Parameter(title: "Habit ID") var habitId: String
    @Parameter(title: "Date") var date: String

    init() {}
    init(habitId: String, date: String) {
        self.habitId = habitId
        self.date = date
    }

    func perform() async throws -> some IntentResult {
        guard let defaults = sharedDefaults() else { return .result() }

        var snapshot = loadSnapshot() ?? TodaySnapshot(date: localTodayKey(), habits: [])
        let current = doneFor(snapshot, habitId: habitId, date: date)
        let newDone = !current

        // Optimistically update the snapshot so the widget reflects the tap
        // immediately; the app reconciles the authoritative value later.
        if let hIdx = snapshot.habits.firstIndex(where: { $0.id == habitId }) {
            if let dIdx = snapshot.habits[hIdx].days.firstIndex(where: { $0.date == date }) {
                snapshot.habits[hIdx].days[dIdx].done = newDone
            } else {
                snapshot.habits[hIdx].days.append(WidgetDay(date: date, done: newDone))
            }
        }

        writeSnapshot(snapshot, into: defaults)
        appendPendingToggle(habitId: habitId, date: date, done: newDone, into: defaults)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Timeline

struct HabitsEntry: TimelineEntry {
    let date: Date
    let today: String
    let habits: [WidgetHabit]
}

struct HabitsProvider: TimelineProvider {
    private func makeEntry() -> HabitsEntry {
        let keys = recentDateKeys()
        let today = keys.last ?? localTodayKey()
        return HabitsEntry(date: Date(), today: today, habits: displayHabits(loadSnapshot(), dateKeys: keys))
    }

    func placeholder(in context: Context) -> HabitsEntry {
        HabitsEntry(date: Date(), today: localTodayKey(), habits: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitsEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsEntry>) -> Void) {
        // Reload at the next local midnight so the day cells roll over even if
        // the app never runs.
        completion(Timeline(entries: [makeEntry()], policy: .after(startOfNextDay())))
    }
}

// MARK: - Views

// Card + cell colors (kept in sync with src/widget/HabitsWidget.tsx).
private let CARD_BG = Color(red: 0.09, green: 0.09, blue: 0.10)   // #17171A
private let CELL_DONE = Color(red: 0.976, green: 0.451, blue: 0.086) // #F97316
private let CELL_MUTED = Color(red: 0.227, green: 0.227, blue: 0.235) // #3A3A3C

// MARK: - Grid constants (keep in sync with src/widget/gridConstants.ts)
// Each habit is a row of equal square cells: [icon] [day box] … The cells are a
// compact fixed size; the spacing then grows to fill the width evenly, so every
// gap and both end margins are equal ("spread evenly to fill").
private let MAX_CELL: CGFloat = 20
private let MIN_CELL: CGFloat = 12
private let MIN_GAP: CGFloat = 8
private let CORNER_RATIO: CGFloat = 0.28
private let EMOJI_SCALE: CGFloat = 1.0

// Resolved geometry for one widget render.
struct WidgetGrid {
    let cell: CGFloat
    let spacing: CGFloat    // equal between every cell and at both edges
    let cornerRadius: CGFloat
    let emojiFont: CGFloat
}

// Even "space-evenly" spacing for `count` cells of `cell` along an axis of
// `available` length: the leftover is split across the `count + 1` gaps (both
// end margins + inner gaps), floored at MIN_GAP. Used for the horizontal grid
// and, with the row capacity, for the vertical row spacing.
private func spreadSpacing(available: CGFloat, count: Int, cell: CGFloat) -> CGFloat {
    let n = CGFloat(count)
    return available > 0 ? max(MIN_GAP, (available - n * cell) / (n + 1)) : MIN_GAP
}

// Derive the grid from the available width and the number of cells across one
// habit-row (`colsEff` = icon columns + box columns, e.g. 4 for icon+3 boxes).
// Cells take the compact target size; `spacing` fills the leftover evenly.
private func computeGrid(availableWidth: CGFloat, colsEff: Int) -> WidgetGrid {
    let cols = CGFloat(colsEff)
    let cellFit = availableWidth > 0
        ? min(MAX_CELL, (availableWidth - (cols + 1) * MIN_GAP) / cols)
        : MAX_CELL
    let cell = min(MAX_CELL, max(MIN_CELL, cellFit))
    let spacing = spreadSpacing(available: availableWidth, count: colsEff, cell: cell)
    return WidgetGrid(
        cell: cell,
        spacing: spacing,
        cornerRadius: CORNER_RATIO * cell,
        emojiFont: EMOJI_SCALE * cell
    )
}

// A single tappable day cell — a bare rounded square, filled when done.
struct DayCell: View {
    let day: WidgetDay
    let cell: CGFloat
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(day.done ? CELL_DONE : CELL_MUTED)
            .frame(width: cell, height: cell)
            .contentShape(Rectangle()) // whole square is the tap target
    }
}

// The flat cells for one habit — an icon cell followed by its day cells — emitted
// as siblings so the enclosing row `HStack(spacing:)` spaces every cell (icons and
// boxes alike) uniformly. Icon only — no habit name, no labels. The emoji fills
// the same square as a box and scales down for wide glyphs (💦, 🍉).
@ViewBuilder
private func habitCells(habit: WidgetHabit, todayOnly: Bool, grid: WidgetGrid) -> some View {
    Text(habit.emoji)
        .font(.system(size: grid.emojiFont))
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .frame(width: grid.cell, height: grid.cell)
    let days = todayOnly ? Array(habit.days.suffix(1)) : habit.days
    ForEach(days, id: \.date) { day in
        Button(intent: ToggleHabitIntent(habitId: habit.id, date: day.date)) {
            DayCell(day: day, cell: grid.cell, cornerRadius: grid.cornerRadius)
        }
        .buttonStyle(.plain)
    }
}

struct HabitsWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: HabitsProvider.Entry

    // Always two columns. Small shows only today's square per habit (so ~8 fit);
    // medium/large show the full 3-day strip. Widgets can't scroll, so cap rows
    // to what fits each family's height.
    private let columns = 2
    private var todayOnly: Bool { family == .systemSmall }
    private var maxRows: Int {
        switch family {
        case .systemLarge: return 8
        default: return 4 // small + medium are the same height
        }
    }
    // Cells in one habit group: an icon plus either 3 day boxes (wide) or 1
    // (narrow today-only). The grid is computed per column so each habit is its
    // own even-filled mini-grid.
    private var perGroupCols: Int { 1 + (todayOnly ? 1 : 3) }
    // Habits chunked into rows of `columns`, capped to what fits the family.
    private var rows: [[WidgetHabit]] {
        let shown = Array(entry.habits.prefix(columns * maxRows))
        return stride(from: 0, to: shown.count, by: columns).map { start in
            Array(shown[start..<min(start + columns, shown.count)])
        }
    }

    var body: some View {
        Group {
            if entry.habits.isEmpty {
                Text("No habits yet")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Top-aligned rows. The grid is computed per column so each habit is
                // its own even-filled mini-grid; the two columns split the width.
                // Vertical spacing uses the row *capacity*, so a full widget fills
                // its height with equal gaps and margins (fewer rows leave the
                // bottom empty).
                GeometryReader { geo in
                    let colWidth = geo.size.width / CGFloat(columns)
                    let grid = computeGrid(availableWidth: colWidth, colsEff: perGroupCols)
                    let vSpacing = spreadSpacing(available: geo.size.height, count: maxRows, cell: grid.cell)
                    VStack(spacing: vSpacing) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 0) {
                                ForEach(row) { habit in
                                    HStack(spacing: grid.spacing) {
                                        habitCells(habit: habit, todayOnly: todayOnly, grid: grid)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                // Keep a partial last row's habit under column 1.
                                ForEach(0..<(columns - row.count), id: \.self) { _ in
                                    Color.clear.frame(maxWidth: .infinity)
                                }
                            }
                        }
                    }
                    .padding(.vertical, vSpacing)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
        }
        .containerBackground(CARD_BG, for: .widget)
    }
}

// A small (2×2) variant showing 4 habits in a single column, each with the full
// 3-day strip (the original "Looped" reference look).
struct HabitsHistoryEntryView: View {
    var entry: HabitsProvider.Entry
    private let maxRows = 4 // single column
    private let perGroupCols = 4 // single column: icon + 3 boxes

    var body: some View {
        Group {
            if entry.habits.isEmpty {
                Text("No habits yet")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                GeometryReader { geo in
                    // Single column: colWidth == full width. Vertical spacing uses
                    // the row capacity so a full widget fills its height evenly.
                    let grid = computeGrid(availableWidth: geo.size.width, colsEff: perGroupCols)
                    let vSpacing = spreadSpacing(available: geo.size.height, count: maxRows, cell: grid.cell)
                    VStack(spacing: vSpacing) {
                        ForEach(entry.habits.prefix(maxRows)) { habit in
                            HStack(spacing: grid.spacing) {
                                habitCells(habit: habit, todayOnly: false, grid: grid)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.vertical, vSpacing)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
        }
        .containerBackground(CARD_BG, for: .widget)
    }
}

// MARK: - Widgets

struct HabitsWidget: Widget {
    let kind: String = "HabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Habits")
        .description("Tap a day to complete your habits.")
        // Small (2 home-columns wide) shows a single habit column like the
        // reference; medium/large (4 wide) show two columns.
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        // We manage our own border padding via the grid, so drop the default
        // widget content margins.
        .contentMarginsDisabled()
    }
}

struct HabitsHistoryWidget: Widget {
    let kind: String = "HabitsHistory"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsHistoryEntryView(entry: entry)
        }
        .configurationDisplayName("Habits · 3-Day")
        .description("Four habits with the last 3 days.")
        // 2×2 only: four habits in a single column, each with the 3-day strip.
        .supportedFamilies([.systemSmall])
        // We manage our own border padding via the grid, so drop the default
        // widget content margins.
        .contentMarginsDisabled()
    }
}

@main
struct HabitsWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Listed first so it appears first in the widget gallery.
        HabitsHistoryWidget()
        HabitsWidget()
    }
}

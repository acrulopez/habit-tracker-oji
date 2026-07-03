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

// A single tappable day cell — a bare rounded square, filled when done.
struct DayCell: View {
    let day: WidgetDay

    var body: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(day.done ? CELL_DONE : CELL_MUTED)
            .frame(width: 22, height: 22)
    }
}

// One habit as a grid cell: emoji on the left, then either the full 3-day strip
// or just today's square (small widget). Icon only — no habit name, no labels.
struct HabitCellView: View {
    let habit: WidgetHabit
    let today: String
    let todayOnly: Bool

    // Narrow (small) widget shows only today so two columns of habits fit.
    private var displayDays: [WidgetDay] {
        todayOnly ? Array(habit.days.suffix(1)) : habit.days
    }
    // The small widget's 2-column cells are narrow, so use a smaller emoji and
    // tighter gap there to keep wide emojis (💦, 🍉) from clipping at the edge.
    private var emojiSize: CGFloat { todayOnly ? 17 : 20 }
    private var emojiSpacing: CGFloat { todayOnly ? 6 : 10 }

    // Natural-sized group (emoji + squares); the parent row positions it within
    // its column.
    var body: some View {
        HStack(spacing: emojiSpacing) {
            Text(habit.emoji)
                .font(.system(size: emojiSize))
                .fixedSize() // never compress/clip the emoji
            HStack(spacing: 6) {
                ForEach(displayDays, id: \.date) { day in
                    Button(intent: ToggleHabitIntent(habitId: habit.id, date: day.date)) {
                        DayCell(day: day)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
                // Top-aligned rows.
                VStack(spacing: 14) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 0) {
                            if todayOnly {
                                // Small: left column hugs the leading edge, right
                                // column centered in its half.
                                ForEach(Array(row.enumerated()), id: \.offset) { i, habit in
                                    HabitCellView(habit: habit, today: entry.today, todayOnly: true)
                                        .frame(maxWidth: .infinity, alignment: i == 0 ? .leading : .center)
                                }
                                ForEach(0..<(columns - row.count), id: \.self) { _ in
                                    Color.clear.frame(maxWidth: .infinity)
                                }
                            } else {
                                // Medium/large: equal space left / middle / right.
                                Spacer(minLength: 0)
                                ForEach(Array(row.enumerated()), id: \.offset) { _, habit in
                                    HabitCellView(habit: habit, today: entry.today, todayOnly: false)
                                    Spacer(minLength: 0)
                                }
                            }
                        }
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
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

    var body: some View {
        Group {
            if entry.habits.isEmpty {
                Text("No habits yet")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 14) {
                    ForEach(entry.habits.prefix(maxRows)) { habit in
                        HabitCellView(habit: habit, today: entry.today, todayOnly: false)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
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

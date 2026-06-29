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

private func keyToDate(_ key: String) -> Date? {
    dateKeyFormatter().date(from: key)
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

private func recentDayLabel(_ key: String, today: String) -> String {
    if key == today { return "Today" }
    if let kd = keyToDate(key), let td = keyToDate(today) {
        let days = Calendar.current.dateComponents([.day], from: kd, to: td).day ?? 0
        if days == 1 { return "Yest." }
        let weekday = DateFormatter()
        weekday.locale = Locale(identifier: "en_US_POSIX")
        weekday.dateFormat = "EEEEE" // narrow single-letter weekday
        return weekday.string(from: kd)
    }
    return key
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

struct DayCell: View {
    let day: WidgetDay
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
            ZStack {
                Circle()
                    .fill(day.done ? Color.green : Color.secondary.opacity(0.2))
                    .frame(width: 24, height: 24)
                if day.done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
        }
    }
}

struct HabitRowView: View {
    let habit: WidgetHabit
    let today: String

    var body: some View {
        HStack(spacing: 8) {
            Text(habit.emoji)
            Text(habit.name)
                .font(.subheadline)
                .lineLimit(1)
            Spacer(minLength: 4)
            HStack(spacing: 6) {
                ForEach(habit.days, id: \.date) { day in
                    Button(intent: ToggleHabitIntent(habitId: habit.id, date: day.date)) {
                        DayCell(day: day, label: recentDayLabel(day.date, today: today))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct HabitsWidgetEntryView: View {
    var entry: HabitsProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if entry.habits.isEmpty {
                Text("No habits yet")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(entry.habits.prefix(5)) { habit in
                    HabitRowView(habit: habit, today: entry.today)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Widget

struct HabitsWidget: Widget {
    let kind: String = "HabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Habits")
        .description("Tap a day to complete your habits.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct HabitsWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabitsWidget()
    }
}

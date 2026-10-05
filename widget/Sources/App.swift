import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        // plannerbar://auth?... from the web app's pairing page
        NSAppleEventManager.shared().setEventHandler(
            self, andSelector: #selector(handleURL(_:reply:)),
            forEventClass: AEEventClass(kInternetEventClass), andEventID: AEEventID(kAEGetURL)
        )
    }

    @objc func handleURL(_ event: NSAppleEventDescriptor, reply: NSAppleEventDescriptor) {
        guard let s = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue, let url = URL(string: s) else { return }
        Task { @MainActor in Model.shared.handle(url: url) }
    }
}

@main
struct PlannerBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var model = Model.shared

    var body: some Scene {
        MenuBarExtra {
            PopoverView()
                .environmentObject(model)
                .frame(width: 340)
                .onAppear { model.popoverOpen = true; Task { await model.refresh() } }
                .onDisappear { model.popoverOpen = false }
        } label: {
            MenuLabel().environmentObject(model)
        }
        .menuBarExtraStyle(.window)
    }
}

// MARK: palette (Notion dark)

enum Palette {
    static let bg = Color(red: 0.082, green: 0.082, blue: 0.082)
    static let panel = Color(red: 0.125, green: 0.125, blue: 0.125)
    static let line = Color.white.opacity(0.085)
    static let ink = Color.white.opacity(0.92)
    static let ink2 = Color.white.opacity(0.6)
    static let ink3 = Color.white.opacity(0.38)
    static let accent = Color(red: 0.137, green: 0.514, blue: 0.886)
    static let good = Color(red: 0.31, green: 0.682, blue: 0.494)
    static let gold = Color(red: 0.91, green: 0.71, blue: 0.29)
    static let warn = Color(red: 0.878, green: 0.525, blue: 0.31)

    static func course(_ key: String) -> Color {
        switch key {
        case "brown": return Color(red: 0.73, green: 0.52, blue: 0.44)
        case "orange": return Color(red: 0.82, green: 0.54, blue: 0.31)
        case "yellow": return Color(red: 0.81, green: 0.63, blue: 0.32)
        case "green": return Color(red: 0.34, green: 0.65, blue: 0.48)
        case "blue": return Color(red: 0.3, green: 0.54, blue: 0.85)
        case "purple": return Color(red: 0.64, green: 0.45, blue: 0.85)
        case "pink": return Color(red: 0.84, green: 0.37, blue: 0.62)
        case "red": return Color(red: 0.88, green: 0.36, blue: 0.35)
        default: return Color(white: 0.61)
        }
    }
}

func clock(_ ms: Double) -> String {
    let s = max(0, Int(ceil(ms / 1000)))
    let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%02d:%02d", m, sec)
}

func dueText(_ item: Item, now: Date) -> String {
    let n = now.ms
    if item.kind != "exam" && n > item.due {
        if let l = item.lateDue, n < l { return "Late window · " + relative(l, now) }
        return "Whenever you're ready"
    }
    return relative(item.due, now)
}

func relative(_ ms: Double, _ now: Date) -> String {
    let d = Date(timeIntervalSince1970: ms / 1000)
    let cal = Calendar.current
    let t = DateFormatter()
    t.dateFormat = cal.component(.minute, from: d) == 0 ? "h a" : "h:mm a"
    if cal.isDateInToday(d) { return "Today · " + t.string(from: d) }
    if cal.isDateInTomorrow(d) { return "Tomorrow · " + t.string(from: d) }
    let days = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: d)).day ?? 0
    let f = DateFormatter()
    f.dateFormat = days < 7 ? "EEE" : "MMM d"
    return f.string(from: d) + " · " + t.string(from: d)
}

// MARK: menu bar label

struct MenuLabel: View {
    @EnvironmentObject var m: Model

    var body: some View {
        if let t = m.timer, t.active {
            let rem = t.remaining(m.now.ms)
            HStack(spacing: 4) {
                Image(systemName: t.paused ? "pause.circle" : (t.phase == "work" ? "timer" : "cup.and.saucer"))
                Text(clock(rem)).monospacedDigit()
            }
        } else if let c = m.nextClass, c.start.timeIntervalSince(m.now) < 45 * 60 {
            HStack(spacing: 4) {
                Image(systemName: "graduationcap")
                Text(c.start > m.now ? "\(c.course.code.isEmpty ? c.course.name : c.course.code) \(shortTime(c.start))" : "In class")
            }
        } else {
            let due = m.queue.filter { Date(timeIntervalSince1970: $0.due / 1000) < Calendar.current.startOfDay(for: m.now).addingTimeInterval(86_400) }.count
            HStack(spacing: 3) {
                Image(systemName: "checklist")
                if due > 0 { Text("\(due)").monospacedDigit() }
            }
        }
    }

    func shortTime(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "h:mm"
        return f.string(from: d)
    }
}

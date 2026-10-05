import AppKit
import Foundation
import Security

// MARK: data types mirrored from the web app (lib/types.ts)

struct Subtask: Identifiable {
    let id: String
    var title: String
    var done: Bool
    var raw: [String: Any]
}

struct Item: Identifiable {
    let id: String
    let kind: String
    let title: String
    let courseId: String?
    let due: Double
    let lateDue: Double?
    var subtasks: [Subtask]
    let updateTime: String?

    var visible: Bool {
        let now = Date().ms
        if kind == "exam" { return now < due + 3 * 3_600_000 }
        if let l = lateDue, now > l { return false }
        return true
    }

    var effectiveDeadline: Double {
        let now = Date().ms
        if now < due { return due }
        if let l = lateDue, now < l { return l }
        return .infinity
    }

    var openSteps: [Subtask] { subtasks.filter { !$0.done } }
}

struct Course {
    let id: String
    let name: String
    let code: String
    let color: String
    let meetings: [[String: Any]]
}

struct TimerState {
    var active: Bool
    var itemId: String?
    var phase: String
    var workMin: Double
    var breakMin: Double
    var endsAt: Double?
    var remainingMs: Double?
    var cycle: Double
    var raw: [String: Any]
    var updateTime: String?

    var phaseMs: Double { (phase == "work" ? workMin : breakMin) * 60_000 }
    var paused: Bool { endsAt == nil }
    func remaining(_ now: Double = Date().ms) -> Double {
        if let e = endsAt { return e - now }
        return remainingMs ?? phaseMs
    }
}

extension Date {
    var ms: Double { timeIntervalSince1970 * 1000 }
}

// MARK: keychain

enum Keychain {
    static let service = "com.planner.bar"

    static func save(_ value: String, account: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func load(_ account: String) -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func delete(_ account: String) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] as CFDictionary)
    }
}

// MARK: model

@MainActor
final class Model: ObservableObject {
    static let shared = Model()

    @Published var now = Date()
    @Published var connected = false
    @Published var name = ""
    @Published var items: [Item] = []
    @Published var courses: [String: Course] = [:]
    @Published var timer: TimerState?
    @Published var points: Double = 0
    @Published var error: String?
    @Published var appURL: String
    var popoverOpen = false

    private var client: FirestoreClient?
    private var pendingState: String?
    private var lastFetch = Date.distantPast
    private var fetching = false
    private var advancing = false

    init() {
        let bundled = Bundle.main.object(forInfoDictionaryKey: "PlannerAppURL") as? String
        appURL = UserDefaults.standard.string(forKey: "appURL") ?? bundled ?? "http://localhost:3000"
        if let uid = Keychain.load("uid"), let rt = Keychain.load("refresh") {
            client = FirestoreClient(uid: uid, refreshToken: rt)
            connected = true
            name = UserDefaults.standard.string(forKey: "name") ?? ""
        }
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            Task { @MainActor in self.tick() }
        }
        Task { await refresh() }
    }

    func setAppURL(_ s: String) {
        var u = s.trimmingCharacters(in: .whitespacesAndNewlines)
        while u.hasSuffix("/") { u.removeLast() }
        if !u.hasPrefix("http") { u = "https://" + u }
        appURL = u
        UserDefaults.standard.set(u, forKey: "appURL")
    }

    // MARK: pairing

    func startConnect() {
        let state = (0..<32).map { _ in String("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".randomElement()!) }.joined()
        pendingState = state
        if let url = URL(string: "\(appURL)/link-widget?state=\(state)") { NSWorkspace.shared.open(url) }
    }

    func handle(url: URL) {
        guard url.scheme == "plannerbar", url.host == "auth",
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let q = Dictionary(uniqueKeysWithValues: (comps.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        // Only accept a response to a connection this app started.
        guard let st = q["state"], st == pendingState, let code = q["code"] else {
            error = "That link wasn't requested by this app — try Connect again."
            return
        }
        pendingState = nil
        connect(code: code)
    }

    @discardableResult
    func connect(code: String) -> Bool {
        guard let data = Data(base64Encoded: code.trimmingCharacters(in: .whitespacesAndNewlines)),
              let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let uid = j["uid"] as? String, let token = j["token"] as? String
        else {
            error = "That connection code doesn't look right."
            return false
        }
        Keychain.save(uid, account: "uid")
        Keychain.save(token, account: "refresh")
        name = j["name"] as? String ?? ""
        UserDefaults.standard.set(name, forKey: "name")
        client = FirestoreClient(uid: uid, refreshToken: token)
        connected = true
        error = nil
        Task { await refresh() }
        return true
    }

    func disconnect() {
        Keychain.delete("uid")
        Keychain.delete("refresh")
        client = nil
        connected = false
        items = []
        timer = nil
        points = 0
    }

    // MARK: sync loop

    private func tick() {
        now = Date()
        let interval: TimeInterval = (timer?.active == true || popoverOpen) ? 5 : 30
        if now.timeIntervalSince(lastFetch) >= interval { Task { await refresh() } }
        if let t = timer, t.active, let e = t.endsAt, now.ms >= e { Task { await advance() } }
    }

    func refresh() async {
        guard let c = client, !fetching else { return }
        fetching = true
        defer { fetching = false; lastFetch = Date() }
        do {
            async let timerDoc = c.get("\(c.userPath)/state/timer")
            async let profile = c.get(c.userPath)
            async let itemDocs = c.openItems()
            async let courseDocs = c.list("\(c.userPath)/courses")
            let (t, p, its, cs) = try await (timerDoc, profile, itemDocs, courseDocs)
            if c.refreshToken != Keychain.load("refresh") { Keychain.save(c.refreshToken, account: "refresh") }
            timer = t.map(Model.parseTimer)
            points = p?.fields["points"] as? Double ?? 0
            items = its.map(Model.parseItem)
            courses = Dictionary(uniqueKeysWithValues: cs.map { d in
                (d.id, Course(id: d.id, name: d.fields["name"] as? String ?? "", code: d.fields["code"] as? String ?? "",
                              color: d.fields["color"] as? String ?? "gray", meetings: d.fields["meetings"] as? [[String: Any]] ?? []))
            })
            error = nil
        } catch FSError.http(let code, _) where code == 400 || code == 401 || code == 403 {
            error = "Session expired — please reconnect."
        } catch {
            self.error = "Offline — will retry."
        }
    }

    static func parseTimer(_ d: FS.Doc) -> TimerState {
        let f = d.fields
        return TimerState(
            active: f["active"] as? Bool ?? false, itemId: f["itemId"] as? String, phase: f["phase"] as? String ?? "work",
            workMin: f["workMin"] as? Double ?? 25, breakMin: f["breakMin"] as? Double ?? 5,
            endsAt: f["endsAt"] as? Double, remainingMs: f["remainingMs"] as? Double, cycle: f["cycle"] as? Double ?? 0,
            raw: f, updateTime: d.updateTime
        )
    }

    static func parseItem(_ d: FS.Doc) -> Item {
        let f = d.fields
        let subs = (f["subtasks"] as? [Any] ?? []).compactMap { $0 as? [String: Any] }.map {
            Subtask(id: $0["id"] as? String ?? UUID().uuidString, title: $0["title"] as? String ?? "", done: $0["done"] as? Bool ?? false, raw: $0)
        }
        return Item(id: d.id, kind: f["kind"] as? String ?? "task", title: f["title"] as? String ?? "", courseId: f["courseId"] as? String,
                    due: f["due"] as? Double ?? 0, lateDue: f["lateDue"] as? Double, subtasks: subs, updateTime: d.updateTime)
    }

    // MARK: derived

    var activeItem: Item? {
        guard let t = timer, t.active, let id = t.itemId else { return nil }
        return items.first { $0.id == id }
    }

    var queue: [Item] {
        let n = now.ms
        return items.filter { $0.visible && ($0.kind != "exam" || $0.due > n) }
            .sorted { $0.effectiveDeadline == $1.effectiveDeadline ? $0.due < $1.due : $0.effectiveDeadline < $1.effectiveDeadline }
    }

    var level: (level: Int, progress: Double) {
        var l = 1
        while 50.0 * Double(l + 1) * Double(l) <= points { l += 1 }
        let floor = 50.0 * Double(l) * Double(l - 1), ceil = 50.0 * Double(l + 1) * Double(l)
        return (l, (points - floor) / (ceil - floor))
    }

    /// Next class today that hasn't ended (simplified weekly-meeting expansion).
    var nextClass: (course: Course, start: Date, location: String)? {
        let cal = Calendar.current
        let today = Model.dayKey(now)
        let dow = cal.component(.weekday, from: now) - 1
        var best: (Course, Date, String)?
        for c in courses.values {
            for m in c.meetings {
                guard let days = m["days"] as? [Any], days.contains(where: { ($0 as? Double).map(Int.init) == dow }),
                      let s = m["start"] as? String, let e = m["end"] as? String,
                      let sd = m["startDate"] as? String, let ed = m["endDate"] as? String, today >= sd, today <= ed,
                      !((m["exdates"] as? [Any])?.contains { ($0 as? String) == today } ?? false),
                      let start = Model.at(s), let end = Model.at(e), end > now
                else { continue }
                if best == nil || start < best!.1 { best = (c, start, (m["location"] as? String) ?? "") }
            }
        }
        return best.map { ($0.0, $0.1, $0.2) }
    }

    static func dayKey(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    static func at(_ hhmm: String) -> Date? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: p[0], minute: p[1], second: 0, of: Date())
    }

    // MARK: actions (same semantics as lib/actions.ts)

    private func award(_ c: FirestoreClient, _ inc: [String: Double]) -> [[String: Any]] {
        var profile: [String: Double] = [:], day: [String: Double] = [:]
        if let p = inc["points"] { profile["points"] = p; day["points"] = p }
        if let s = inc["subtasks"] { profile["subtasksDone"] = s; day["subtasks"] = s }
        if let f = inc["focusMs"] { profile["focusMs"] = f; day["focusMs"] = f }
        let key = Model.dayKey(Date())
        return [
            c.incrementWrite(c.userPath, profile),
            c.incrementWrite("\(c.userPath)/days/\(key)", day, seed: ["date": key]),
        ]
    }

    func togglePause() async {
        guard let c = client, var t = timer else { return }
        let n = Date().ms
        var fields: [String: Any] = ["updatedAt": n]
        if let e = t.endsAt {
            fields["endsAt"] = NSNull(); fields["remainingMs"] = max(0, e - n)
            t.remainingMs = max(0, e - n); t.endsAt = nil
        } else {
            let rem = t.remainingMs ?? t.phaseMs
            fields["endsAt"] = n + rem; fields["remainingMs"] = NSNull()
            t.endsAt = n + rem; t.remainingMs = nil
        }
        timer = t
        try? await c.commit([c.updateWrite("\(c.userPath)/state/timer", fields)])
        await refresh()
    }

    func advance(skip: Bool = false) async {
        guard let c = client, let t = timer, t.active, !advancing else { return }
        advancing = true
        defer { advancing = false }
        let n = Date().ms
        let next = t.phase == "work" ? "break" : "work"
        let nextLen = (next == "work" ? t.workMin : t.breakMin) * 60_000
        let ended = t.endsAt ?? n
        let fresh = !skip && t.endsAt != nil && n - ended < 90_000
        let fields: [String: Any] = [
            "phase": next, "cycle": t.phase == "work" ? t.cycle + 1 : t.cycle, "updatedAt": n,
            "endsAt": skip ? n + nextLen : (fresh ? ended + nextLen : NSNull()),
            "remainingMs": (skip || fresh) ? NSNull() : nextLen,
        ]
        var writes = [c.updateWrite("\(c.userPath)/state/timer", fields, precondition: t.updateTime)]
        if t.phase == "work", let itemId = t.itemId {
            let worked = skip ? t.phaseMs - max(0, t.remaining(n)) : t.phaseMs
            if worked >= 60_000 {
                writes += award(c, ["points": floor(worked / 60_000), "focusMs": worked])
                writes.append(c.incrementWrite("\(c.userPath)/items/\(itemId)", ["focusMs": worked]))
            }
        }
        // The precondition makes this a no-op if a browser already advanced it.
        try? await c.commit(writes)
        await refresh()
    }

    func check(_ s: Subtask, in item: Item) async {
        guard let c = client else { return }
        let subs: [Any] = item.subtasks.map { x -> [String: Any] in
            var r = x.raw
            if x.id == s.id { r["done"] = true; r["doneAt"] = Date().ms }
            return r
        }
        if let i = items.firstIndex(where: { $0.id == item.id }), let j = items[i].subtasks.firstIndex(where: { $0.id == s.id }) {
            items[i].subtasks[j].done = true
        }
        var writes = [c.updateWrite("\(c.userPath)/items/\(item.id)", ["subtasks": subs], precondition: item.updateTime)]
        writes += award(c, ["points": 10, "subtasks": 1])
        do { try await c.commit(writes) } catch { self.error = "Couldn't save — it changed elsewhere. Refreshed." }
        await refresh()
    }

    func openApp(_ path: String = "") {
        if let u = URL(string: appURL + path) { NSWorkspace.shared.open(u) }
    }
}

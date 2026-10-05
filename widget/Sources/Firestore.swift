import Foundation

/// Minimal Firestore REST client authenticated as the signed-in user, so the
/// same security rules as the web app apply.
enum FS {
    static let projectId = "school-planner-8fd73"
    static let apiKey = "AIzaSyCpkjfMZOvTxui8qtEtanJgaHCy0h-4EX4"
    /// PLANNER_EMULATOR=1 points the widget at the local Firebase emulators (development only).
    static let emulator = ProcessInfo.processInfo.environment["PLANNER_EMULATOR"] == "1"
    static let root = (emulator ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com") + "/v1/projects/\(projectId)/databases/(default)/documents"
    static let tokenURL = (emulator ? "http://127.0.0.1:9099/" : "https://") + "securetoken.googleapis.com/v1/token?key=\(apiKey)"
    static let docPrefix = "projects/\(projectId)/databases/(default)/documents"

    // MARK: value coding

    static func decode(_ v: [String: Any]) -> Any? {
        if let s = v["stringValue"] as? String { return s }
        if let s = v["integerValue"] as? String { return Double(s) ?? 0 }
        if let n = v["integerValue"] as? NSNumber { return n.doubleValue }
        if let d = v["doubleValue"] as? NSNumber { return d.doubleValue }
        if let b = v["booleanValue"] as? Bool { return b }
        if v["nullValue"] != nil { return nil }
        if let t = v["timestampValue"] as? String { return t }
        if let m = v["mapValue"] as? [String: Any] { return decodeFields(m["fields"] as? [String: Any] ?? [:]) }
        if let a = v["arrayValue"] as? [String: Any] {
            return (a["values"] as? [[String: Any]] ?? []).map { decode($0) ?? NSNull() }
        }
        return nil
    }

    static func decodeFields(_ f: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in f { if let v = v as? [String: Any], let d = decode(v) { out[k] = d } }
        return out
    }

    static func encode(_ x: Any?) -> [String: Any] {
        switch x {
        case nil, is NSNull: return ["nullValue": NSNull()]
        case let b as Bool: return ["booleanValue": b]
        case let i as Int: return ["integerValue": String(i)]
        case let d as Double:
            if d.rounded() == d && abs(d) < 9e15 { return ["integerValue": String(Int(d))] }
            return ["doubleValue": d]
        case let s as String: return ["stringValue": s]
        case let a as [Any]: return ["arrayValue": ["values": a.map { encode($0) }]]
        case let m as [String: Any]: return ["mapValue": ["fields": m.mapValues { encode($0) }]]
        default: return ["nullValue": NSNull()]
        }
    }

    struct Doc {
        let name: String
        let id: String
        let fields: [String: Any]
        let updateTime: String?
    }

    static func parseDoc(_ j: [String: Any]) -> Doc? {
        guard let name = j["name"] as? String else { return nil }
        return Doc(
            name: name,
            id: String(name.split(separator: "/").last ?? ""),
            fields: decodeFields(j["fields"] as? [String: Any] ?? [:]),
            updateTime: j["updateTime"] as? String
        )
    }
}

enum FSError: Error, LocalizedError {
    case http(Int, String)
    case notSignedIn
    var errorDescription: String? {
        switch self {
        case .http(let c, let m): return "HTTP \(c): \(m.prefix(160))"
        case .notSignedIn: return "Not connected"
        }
    }
}

final class FirestoreClient {
    private var idToken: String?
    private var expiry = Date.distantPast
    var refreshToken: String
    let uid: String

    init(uid: String, refreshToken: String) {
        self.uid = uid
        self.refreshToken = refreshToken
    }

    var userPath: String { "users/\(uid)" }

    func token() async throws -> String {
        if let t = idToken, Date() < expiry { return t }
        var req = URLRequest(url: URL(string: FS.tokenURL)!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = "grant_type=refresh_token&refresh_token=\(refreshToken.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "")"
        req.httpBody = body.data(using: .utf8)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200, let j = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let t = j["id_token"] as? String
        else { throw FSError.http(code, String(data: data, encoding: .utf8) ?? "") }
        if let r = j["refresh_token"] as? String { refreshToken = r }
        let secs = Double(j["expires_in"] as? String ?? "3600") ?? 3600
        idToken = t
        expiry = Date().addingTimeInterval(secs - 120)
        return t
    }

    private func send(_ method: String, _ url: String, body: [String: Any]? = nil) async throws -> Any? {
        var req = URLRequest(url: URL(string: url)!)
        req.httpMethod = method
        req.setValue("Bearer \(try await token())", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 404 { return nil }
        guard (200..<300).contains(code) else { throw FSError.http(code, String(data: data, encoding: .utf8) ?? "") }
        return data.isEmpty ? nil : try JSONSerialization.jsonObject(with: data)
    }

    func get(_ path: String) async throws -> FS.Doc? {
        guard let j = try await send("GET", "\(FS.root)/\(path)") as? [String: Any] else { return nil }
        return FS.parseDoc(j)
    }

    func list(_ path: String) async throws -> [FS.Doc] {
        let j = try await send("GET", "\(FS.root)/\(path)?pageSize=300") as? [String: Any]
        return (j?["documents"] as? [[String: Any]] ?? []).compactMap(FS.parseDoc)
    }

    func openItems() async throws -> [FS.Doc] {
        let q: [String: Any] = [
            "structuredQuery": [
                "from": [["collectionId": "items"]],
                "where": ["fieldFilter": [
                    "field": ["fieldPath": "status"], "op": "EQUAL", "value": ["stringValue": "open"],
                ]],
                "limit": 300,
            ],
        ]
        let rows = try await send("POST", "\(FS.root)/\(userPath):runQuery", body: q) as? [[String: Any]] ?? []
        return rows.compactMap { ($0["document"] as? [String: Any]).flatMap(FS.parseDoc) }
    }

    /// Atomic batch of writes (documents:commit).
    func commit(_ writes: [[String: Any]]) async throws {
        _ = try await send("POST", "\(FS.root):commit", body: ["writes": writes])
    }

    func docName(_ path: String) -> String { "\(FS.docPrefix)/\(path)" }

    /// update + optional optimistic-concurrency precondition
    func updateWrite(_ path: String, _ fields: [String: Any], precondition updateTime: String? = nil) -> [String: Any] {
        var w: [String: Any] = [
            "update": ["name": docName(path), "fields": fields.mapValues { FS.encode($0) }],
            "updateMask": ["fieldPaths": Array(fields.keys)],
        ]
        if let updateTime { w["currentDocument"] = ["updateTime": updateTime] }
        return w
    }

    /// Increment numeric fields; `seed` fields are set alongside (upsert).
    func incrementWrite(_ path: String, _ inc: [String: Double], seed: [String: Any] = [:]) -> [String: Any] {
        [
            "update": ["name": docName(path), "fields": seed.mapValues { FS.encode($0) }],
            "updateMask": ["fieldPaths": Array(seed.keys)],
            "updateTransforms": inc.map { ["fieldPath": $0.key, "increment": FS.encode($0.value)] },
        ]
    }
}

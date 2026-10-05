import AppKit
import SwiftUI

struct PopoverView: View {
    @EnvironmentObject var m: Model
    @State private var showSettings = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().overlay(Palette.line)
            Group {
                if !m.connected { ConnectView() }
                else if showSettings { SettingsView(done: { showSettings = false }) }
                else { content }
            }
            .padding(14)
            if let e = m.error {
                Text(e).font(.system(size: 11)).foregroundStyle(Palette.warn)
                    .padding(.horizontal, 14).padding(.bottom, 10)
            }
        }
        .background(Palette.bg)
        .preferredColorScheme(.dark)
    }

    var header: some View {
        HStack(spacing: 10) {
            Text("Planner").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.ink)
            Spacer()
            if m.connected {
                let lvl = m.level
                HStack(spacing: 6) {
                    ZStack {
                        Circle().stroke(Color.white.opacity(0.1), lineWidth: 2.5)
                        Circle().trim(from: 0, to: lvl.progress).stroke(Palette.gold, style: .init(lineWidth: 2.5, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(.spring(duration: 0.8), value: lvl.progress)
                        Text("\(lvl.level)").font(.system(size: 8.5, weight: .bold)).foregroundStyle(Palette.gold)
                    }.frame(width: 18, height: 18)
                    Text("\(Int(m.points))").font(.system(size: 12, weight: .semibold)).monospacedDigit().foregroundStyle(Palette.ink)
                        .contentTransition(.numericText())
                        .animation(.spring, value: m.points)
                }
                Button { showSettings.toggle() } label: {
                    Image(systemName: "gearshape").foregroundStyle(Palette.ink3)
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }

    @ViewBuilder var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let t = m.timer, t.active, let item = m.activeItem {
                FocusCard(timer: t, item: item)
            } else if let c = m.nextClass, c.start.timeIntervalSince(m.now) < 60 * 60 {
                ClassCard(course: c.course, start: c.start, location: c.location)
            }
            UpNext()
            HStack {
                Button { m.openApp() } label: {
                    Label("Open Planner", systemImage: "arrow.up.forward.app")
                }
                .buttonStyle(Pill(primary: true))
                Spacer()
                Button { m.openApp("/focus") } label: { Text("Focus") }.buttonStyle(Pill())
                Button { NSApp.terminate(nil) } label: { Image(systemName: "power") }.buttonStyle(Pill())
            }
        }
    }
}

struct Pill: ButtonStyle {
    var primary = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(primary ? Palette.accent : Color.white.opacity(configuration.isPressed ? 0.12 : 0.07))
            .foregroundStyle(primary ? Color.white : Palette.ink)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

struct FocusCard: View {
    @EnvironmentObject var m: Model
    let timer: TimerState
    let item: Item

    var body: some View {
        let rem = timer.remaining(m.now.ms)
        let color = timer.phase == "work" ? Palette.accent : Palette.good
        let steps = item.openSteps
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    Circle().stroke(Color.white.opacity(0.08), lineWidth: 4)
                    Circle().trim(from: 0, to: max(0, min(1, 1 - rem / timer.phaseMs)))
                        .stroke(color, style: .init(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: rem)
                    Image(systemName: timer.phase == "work" ? "brain.head.profile" : "cup.and.saucer.fill")
                        .font(.system(size: 13)).foregroundStyle(color)
                }.frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text(timer.paused ? "PAUSED" : (timer.phase == "work" ? "FOCUS" : "BREAK"))
                        .font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundStyle(color)
                    Text(item.title).font(.system(size: 13, weight: .medium)).foregroundStyle(Palette.ink).lineLimit(1)
                }
                Spacer()
                Text(clock(rem)).font(.system(size: 26, weight: .light)).monospacedDigit().foregroundStyle(Palette.ink)
                    .contentTransition(.numericText(countsDown: true))
            }
            if let now = steps.first {
                HStack(spacing: 10) {
                    Button { Task { await m.check(now, in: item) } } label: {
                        Circle().stroke(Palette.ink3, lineWidth: 1.5).frame(width: 18, height: 18)
                    }.buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("NOW").font(.system(size: 9, weight: .semibold)).tracking(1).foregroundStyle(Palette.ink3)
                        Text(now.title.isEmpty ? "Untitled step" : now.title).font(.system(size: 13)).foregroundStyle(Palette.ink)
                    }
                }
                .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.panel).clipShape(RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(Palette.line))
                .transition(.asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity), removal: .opacity))
                .id(now.id)
                if steps.count > 1 {
                    Text("Up next: \(steps[1].title)").font(.system(size: 11.5)).foregroundStyle(Palette.ink2).lineLimit(1).padding(.leading, 4)
                }
            } else if !item.subtasks.isEmpty {
                Text("Every step is done — finish it up in the app 🎉").font(.system(size: 12)).foregroundStyle(Palette.good)
            }
            HStack(spacing: 6) {
                Button { Task { await m.togglePause() } } label: {
                    Label(timer.paused ? "Resume" : "Pause", systemImage: timer.paused ? "play.fill" : "pause.fill")
                }.buttonStyle(Pill(primary: true))
                Button { Task { await m.advance(skip: true) } } label: {
                    Label("Skip", systemImage: "forward.end.fill")
                }.buttonStyle(Pill())
                Spacer()
                Text("\(Int(timer.workMin))/\(Int(timer.breakMin)) · \(Int(timer.cycle)) done").font(.system(size: 11)).foregroundStyle(Palette.ink3)
            }
        }
        .animation(.spring(duration: 0.35), value: steps.first?.id)
        .padding(12)
        .background(color.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.3)))
    }
}

struct ClassCard: View {
    @EnvironmentObject var m: Model
    let course: Course
    let start: Date
    let location: String

    var body: some View {
        let mins = Int(start.timeIntervalSince(m.now) / 60)
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2).fill(Palette.course(course.color)).frame(width: 3, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(mins > 0 ? "CLASS IN \(mins) MIN" : "CLASS NOW").font(.system(size: 10, weight: .semibold)).tracking(1.1)
                    .foregroundStyle(Palette.course(course.color))
                Text(course.name).font(.system(size: 13, weight: .medium)).foregroundStyle(Palette.ink)
                if !location.isEmpty { Text(location).font(.system(size: 11)).foregroundStyle(Palette.ink3) }
            }
            Spacer()
            Button("Check in") { m.openApp() }.buttonStyle(Pill(primary: true))
        }
        .padding(10).background(Palette.panel).clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct UpNext: View {
    @EnvironmentObject var m: Model

    var body: some View {
        let q = Array(m.queue.prefix(5))
        VStack(alignment: .leading, spacing: 2) {
            Text("Up next").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.ink2).padding(.bottom, 4)
            if q.isEmpty {
                Text("All clear ✨").font(.system(size: 12)).foregroundStyle(Palette.ink3).padding(.vertical, 6)
            }
            ForEach(Array(q.enumerated()), id: \.element.id) { idx, item in
                let c = item.courseId.flatMap { m.courses[$0] }
                let done = item.subtasks.filter(\.done).count
                Button { m.openApp() } label: {
                    HStack(spacing: 8) {
                        Circle().fill(Palette.course(c?.color ?? "gray")).frame(width: 7, height: 7)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.title).font(.system(size: 12.5, weight: idx == 0 ? .medium : .regular)).foregroundStyle(Palette.ink).lineLimit(1)
                            Text([c.map { $0.code.isEmpty ? $0.name : $0.code }, dueText(item, now: m.now)].compactMap { $0 }.joined(separator: " · "))
                                .font(.system(size: 11)).foregroundStyle(item.kind != "exam" && m.now.ms > item.due ? Palette.warn.opacity(0.9) : Palette.ink3)
                                .lineLimit(1)
                        }
                        Spacer()
                        if !item.subtasks.isEmpty {
                            Text("\(done)/\(item.subtasks.count)").font(.system(size: 10.5)).monospacedDigit().foregroundStyle(Palette.ink3)
                        }
                    }
                    .padding(.vertical, 5).padding(.horizontal, 6)
                    .background(idx == 0 ? Color.white.opacity(0.05) : .clear)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .contentShape(Rectangle())
                }.buttonStyle(.plain)
            }
        }
    }
}

struct ConnectView: View {
    @EnvironmentObject var m: Model
    @State private var code = ""
    @State private var url = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Connect your planner").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.ink)
            Text("Your live focus timer and what's up next, right in the menu bar.")
                .font(.system(size: 12)).foregroundStyle(Palette.ink2).fixedSize(horizontal: false, vertical: true)
            TextField("App URL", text: $url)
                .textFieldStyle(.roundedBorder)
                .onAppear { url = m.appURL }
                .onSubmit { m.setAppURL(url) }
            Button { m.setAppURL(url); m.startConnect() } label: {
                Label("Connect account", systemImage: "link").frame(maxWidth: .infinity)
            }.buttonStyle(Pill(primary: true))
            Divider().overlay(Palette.line)
            Text("Or paste a connection code").font(.system(size: 11)).foregroundStyle(Palette.ink3)
            HStack {
                SecureField("Connection code", text: $code).textFieldStyle(.roundedBorder)
                Button("Use") { if m.connect(code: code) { code = "" } }.buttonStyle(Pill()).disabled(code.isEmpty)
            }
            HStack {
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }.buttonStyle(Pill())
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var m: Model
    @State private var url = ""
    let done: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(m.name.isEmpty ? "Connected" : "Connected as \(m.name)").font(.system(size: 13, weight: .medium)).foregroundStyle(Palette.ink)
            Text("App URL").font(.system(size: 11)).foregroundStyle(Palette.ink3)
            TextField("https://…", text: $url).textFieldStyle(.roundedBorder).onAppear { url = m.appURL }
            HStack {
                Button("Save") { m.setAppURL(url); done() }.buttonStyle(Pill(primary: true))
                Button("Disconnect") { m.disconnect(); done() }.buttonStyle(Pill())
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }.buttonStyle(Pill())
            }
        }
    }
}

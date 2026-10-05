"use client";

import { motion } from "motion/react";
import { BookOpen, CalendarPlus, GraduationCap, MapPin, Plus } from "lucide-react";
import { useMemo } from "react";
import { Bar, Button, Card, Empty, Page, SectionTitle } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { colorOf } from "@/lib/colors";
import { addDays, dayKey, dayLabel, fmtTime, parseDay, WEEKDAYS } from "@/lib/dates";
import { isVisible, meetingSummary, sessionsBetween } from "@/lib/schedule";
import { useStore } from "@/lib/store";

export default function ClassesPage() {
  const { courses, items, attendance, now, sessions, ready } = useStore();
  const ui = useUI();
  const today = dayKey(now);

  return (
    <Page className="md:max-w-[1040px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[34px]">Classes</h1>
          <p className="mt-1 text-[14.5px] text-ink-2">Tap a class to add its textbook, exams and assignments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => ui.setImportOpen(true)}>
            Import .ics
          </Button>
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => ui.setNewCourse(true)}>
            Add class
          </Button>
        </div>
      </div>

      {ready && !courses.length ? (
        <div className="mt-8">
          <Empty
            icon={<GraduationCap />}
            title="No classes yet"
            body="Import your timetable as an .ics file, or add classes one by one."
            action={
              <Button variant="primary" onClick={() => ui.setImportOpen(true)}>
                Import .ics
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, idx) => {
              const color = colorOf(c.color);
              const open = items.filter((i) => i.courseId === c.id && isVisible(i, now));
              const exams = open.filter((i) => i.kind === "exam").length;
              const tasks = open.length - exams;
              const att = [...attendance.values()].filter((a) => a.courseId === c.id);
              const a = att.filter((x) => x.status === "attended").length;
              const m = att.filter((x) => x.status === "missed").length;
              const next = sessions.find((s) => s.courseId === c.id && s.end > now);
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => ui.openCourse(c.id)}
                  className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:bg-card"
                >
                  <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color.dot }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {c.code && <div className="text-[12px] font-semibold" style={{ color: color.fg }}>{c.code}</div>}
                      <div className="truncate text-[16px] font-semibold text-ink">{c.name}</div>
                    </div>
                    {c.textbook.kind !== "none" && <BookOpen className="h-4 w-4 shrink-0 text-ink-3" />}
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-ink-3">
                    {c.meetings.slice(0, 2).map((mt) => (
                      <span key={mt.id} className="truncate">
                        {mt.label ? `${mt.label} · ` : ""}
                        {meetingSummary(mt)}
                      </span>
                    ))}
                    {(c.location || next?.location) && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" /> {next?.location || c.location}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
                    {next && (
                      <span className="rounded bg-hover px-1.5 py-0.5 text-ink-2">
                        Next: {dayLabel(next.date, now)} {fmtTime(next.start)}
                      </span>
                    )}
                    {exams > 0 && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">{exams} exam{exams > 1 ? "s" : ""}</span>}
                    {tasks > 0 && <span className="rounded bg-hover px-1.5 py-0.5 text-ink-2">{tasks} open</span>}
                  </div>
                  {a + m > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-ink-3">
                        <span>Attendance</span>
                        <span>{Math.round((a / (a + m)) * 100)}%</span>
                      </div>
                      <Bar value={a / (a + m)} color={color.dot} height={4} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {courses.length > 0 && (
            <section className="mt-10">
              <SectionTitle>This week</SectionTitle>
              <WeekGrid today={today} />
            </section>
          )}
        </>
      )}
    </Page>
  );
}

function WeekGrid({ today }: { today: string }) {
  const { courses, courseMap, now } = useStore();
  const ui = useUI();
  const weekStart = addDays(today, -((parseDay(today).getDay() + 6) % 7)); // Monday
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const sessions = useMemo(() => sessionsBetween(courses, dates[0], dates[6]), [courses, dates]);
  const shownDates = dates.filter((d, i) => i < 5 || sessions.some((s) => s.date === d));

  if (!sessions.length) return <p className="px-1 text-[13px] text-ink-3">No classes this week.</p>;

  const mins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = Math.floor(Math.min(...sessions.map((s) => mins(s.startTime))) / 60) * 60;
  const endMin = Math.ceil(Math.max(...sessions.map((s) => (s.end - s.start) / 60_000 + mins(s.startTime))) / 60) * 60;
  const span = endMin - startMin;
  const pxPerMin = 0.9;
  const hours = Array.from({ length: span / 60 + 1 }, (_, i) => startMin + i * 60);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  return (
    <>
      {/* desktop: timetable */}
      <Card className="hidden overflow-hidden md:block">
        <div className="flex border-b border-line">
          <div className="w-14 shrink-0" />
          {shownDates.map((d) => (
            <div key={d} className={`flex-1 py-2 text-center text-[12.5px] font-medium ${d === today ? "text-ink" : "text-ink-3"}`}>
              {WEEKDAYS[parseDay(d).getDay()]} <span className="tnum">{parseDay(d).getDate()}</span>
            </div>
          ))}
        </div>
        <div className="relative flex" style={{ height: span * pxPerMin }}>
          <div className="relative w-14 shrink-0">
            {hours.slice(0, -1).map((h) => (
              <div key={h} className="tnum absolute right-2 -translate-y-1/2 text-[10.5px] text-ink-3" style={{ top: (h - startMin) * pxPerMin }}>
                {fmtTime(`${String(h / 60).padStart(2, "0")}:00`)}
              </div>
            ))}
          </div>
          {shownDates.map((d) => (
            <div key={d} className={`relative flex-1 border-l border-line ${d === today ? "bg-white/[0.015]" : ""}`}>
              {hours.slice(1, -1).map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - startMin) * pxPerMin }} />
              ))}
              {d === today && nowMin > startMin && nowMin < endMin && (
                <div className="absolute inset-x-0 z-10 h-[2px] bg-danger" style={{ top: (nowMin - startMin) * pxPerMin }}>
                  <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-danger" />
                </div>
              )}
              {sessions
                .filter((s) => s.date === d)
                .map((s) => {
                  const c = courseMap.get(s.courseId)!;
                  const col = colorOf(c.color);
                  const top = (mins(s.startTime) - startMin) * pxPerMin;
                  const h = ((s.end - s.start) / 60_000) * pxPerMin;
                  return (
                    <button
                      key={s.id}
                      onClick={() => ui.openCourse(c.id)}
                      className="absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left transition-[filter] hover:brightness-125"
                      style={{ top, height: Math.max(22, h - 2), background: col.bg, borderColor: col.dot, opacity: s.end < now ? 0.5 : 1 }}
                    >
                      <div className="truncate text-[11.5px] font-semibold" style={{ color: col.fg }}>
                        {c.code || c.name}
                      </div>
                      {h > 34 && <div className="truncate text-[10.5px] text-ink-2">{fmtTime(s.start)}{s.location ? ` · ${s.location}` : ""}</div>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </Card>

      {/* phone: agenda */}
      <div className="flex flex-col gap-4 md:hidden">
        {shownDates.map((d) => {
          const list = sessions.filter((s) => s.date === d);
          if (!list.length) return null;
          return (
            <div key={d}>
              <div className={`mb-1 px-1 text-[13px] font-semibold ${d === today ? "text-ink" : "text-ink-3"}`}>{dayLabel(d, now)}</div>
              <Card className="p-1">
                {list.map((s) => {
                  const c = courseMap.get(s.courseId)!;
                  return (
                    <button key={s.id} onClick={() => ui.openCourse(c.id)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-hover ${s.end < now ? "opacity-50" : ""}`}>
                      <div className="h-7 w-[3px] rounded-full" style={{ background: colorOf(c.color).dot }} />
                      <span className="tnum w-16 text-[12.5px] text-ink-2">{fmtTime(s.start)}</span>
                      <span className="flex-1 truncate text-[14px] text-ink">{c.code || c.name}</span>
                      {s.location && <span className="truncate text-[12px] text-ink-3">{s.location}</span>}
                    </button>
                  );
                })}
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}

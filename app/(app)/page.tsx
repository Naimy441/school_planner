"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, ChevronDown, GraduationCap, Heart, Play, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMarkAttendance } from "@/components/class-gate";
import { ClassRow, DueText, ItemRow } from "@/components/rows";
import { useTick } from "@/components/timer-engine";
import { Bar, Button, Card, Empty, Page, Ring, SectionTitle, Tag } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { phaseMs, remainingOf } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { addDays, dayKey, dayLabel, daysUntil, fmtClock, fmtTime, greeting } from "@/lib/dates";
import { isOverdue, isVisible, nextSubtasks, progressOf, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ClassSession, Item } from "@/lib/types";
import { format } from "date-fns";

const HORIZON = 14;

export default function Overview() {
  const { user, items, sessions, attendance, courses, now, ready } = useStore();
  const ui = useUI();
  const markAtt = useMarkAttendance();
  const [showLater, setShowLater] = useState(false);
  const today = dayKey(now);
  const first = user?.displayName?.split(" ")[0];

  const visible = useMemo(() => items.filter((i) => isVisible(i, now)), [items, now]);
  const queue = useMemo(() => workQueue(items, now), [items, now]);
  const top = queue.find((i) => !isOverdue(i, now) || i.lateDue) || queue[0];
  const exams = visible.filter((i) => i.kind === "exam" && i.due > now && daysUntil(i.due, now) <= 7).sort((a, b) => a.due - b.due);
  const catchUp = visible.filter((i) => isOverdue(i, now)).sort((a, b) => a.due - b.due);

  const days = useMemo(() => {
    const end = addDays(today, HORIZON);
    const map = new Map<string, { classes: ClassSession[]; items: Item[] }>();
    const get = (k: string) => map.get(k) || (map.set(k, { classes: [], items: [] }), map.get(k)!);
    for (const s of sessions) if (s.end > now && s.date <= end && !attendance.has(s.id)) get(s.date).classes.push(s);
    for (const i of visible) {
      if (isOverdue(i, now)) continue;
      const k = dayKey(i.due);
      if (k <= end) get(k).items.push(i);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v, items: v.items.sort((a, b) => a.due - b.due) }));
  }, [sessions, visible, attendance, now, today]);

  const later = visible.filter((i) => !isOverdue(i, now) && dayKey(i.due) > addDays(today, HORIZON)).sort((a, b) => a.due - b.due);
  const dueThisWeek = visible.filter((i) => i.kind !== "exam" && i.due > now && daysUntil(i.due, now) < 7).length;
  const classesToday = sessions.filter((s) => s.date === today).length;

  return (
    <Page>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-[13px] font-medium text-ink-3">{format(now, "EEEE, MMMM d")}</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[34px]">
          {greeting(new Date(now))}
          {first ? `, ${first}` : ""}
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-2">
          {ready
            ? [
                classesToday ? `${classesToday} class${classesToday > 1 ? "es" : ""} today` : "No classes today",
                dueThisWeek ? `${dueThisWeek} thing${dueThisWeek > 1 ? "s" : ""} due this week` : "nothing due this week",
              ].join(" · ")
            : " "}
        </p>
      </motion.div>

      <div className="mt-7 flex flex-col gap-8">
        <ActiveTimerCard />

        {ready && !courses.length && (
          <Card className="overflow-hidden p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">Let&apos;s set up your semester</div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
                  Import your timetable (.ics) or add classes by hand. Then add exams and assignments to each class.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => ui.setImportOpen(true)}>
                    Import .ics
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => ui.setNewCourse(true)}>
                    Add a class
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {exams.length > 0 && (
          <section>
            <SectionTitle>Exams this week</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {exams.map((e, i) => (
                <ExamSpotlight key={e.id} item={e} index={i} />
              ))}
            </div>
          </section>
        )}

        {top && <UpNext item={top} />}

        {catchUp.length > 0 && (
          <section>
            <SectionTitle>Catching up</SectionTitle>
            <div className="mb-2 flex items-center gap-2 px-1 text-[13px] text-ink-3">
              <Heart className="h-3.5 w-3.5 text-warn" /> No rush — falling behind happens. One small step gets things moving again.
            </div>
            <Card className="p-1">
              <AnimatePresence initial={false}>
                {catchUp.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </AnimatePresence>
            </Card>
          </section>
        )}

        <section>
          <SectionTitle
            right={
              <Link href="/classes" className="text-[12.5px] text-ink-3 hover:text-ink-2">
                Classes →
              </Link>
            }
          >
            Next two weeks
          </SectionTitle>
          {!ready ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer h-14 rounded-xl" />
              ))}
            </div>
          ) : days.length ? (
            <div className="flex flex-col gap-5">
              {days.map((d) => (
                <motion.div key={d.date} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-1 flex items-baseline gap-2 px-2.5">
                    <span className={d.date === today ? "text-[14px] font-semibold text-ink" : "text-[14px] font-semibold text-ink-2"}>
                      {dayLabel(d.date, now)}
                    </span>
                    {d.date !== today && d.date !== addDays(today, 1) ? null : (
                      <span className="text-[12.5px] text-ink-3">{format(new Date(d.date + "T12:00"), "MMM d")}</span>
                    )}
                  </div>
                  <Card className="p-1">
                    <AnimatePresence initial={false}>
                      {d.classes.map((s) => (
                        <ClassRow key={s.id} s={s} onCheckIn={() => markAtt(s, "attended")} />
                      ))}
                      {d.items.map((i) => (
                        <ItemRow key={i.id} item={i} />
                      ))}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Empty icon={<Sparkles />} title="All clear" body="Nothing scheduled in the next two weeks. Add an exam or assignment with the + button." />
          )}
          {later.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowLater((v) => !v)} className="flex items-center gap-1.5 px-2.5 text-[13px] text-ink-3 hover:text-ink-2">
                <motion.span animate={{ rotate: showLater ? 0 : -90 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
                Later · {later.length}
              </button>
              <AnimatePresence>
                {showLater && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="mt-2 p-1">
                      {later.map((i) => (
                        <ItemRow key={i.id} item={i} />
                      ))}
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}

function ActiveTimerCard() {
  const { timer, itemMap } = useStore();
  const now = useTick(timer?.active ? 1000 : null);
  const item = timer?.itemId ? itemMap.get(timer.itemId) : undefined;
  if (!timer?.active || !item) return null;
  const rem = remainingOf(timer, now);
  const isWork = timer.phase === "work";
  const { current } = nextSubtasks(item);
  return (
    <Link href="/focus">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.99 }}
        className="flex items-center gap-4 rounded-xl border p-4"
        style={{
          borderColor: isWork ? "rgba(35,131,226,0.35)" : "rgba(79,174,126,0.35)",
          background: isWork ? "var(--accent-soft)" : "var(--good-soft)",
        }}
      >
        <Ring value={1 - rem / phaseMs(timer)} size={48} stroke={4} color={isWork ? "var(--accent)" : "var(--good)"} spin>
          <Play className="h-4 w-4 fill-current text-ink" />
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: isWork ? "var(--accent)" : "var(--good)" }}>
            {timer.endsAt == null ? "Paused" : isWork ? "Focusing" : "On a break"}
          </div>
          <div className="truncate text-[15px] font-medium text-ink">{item.title}</div>
          {current && <div className="truncate text-[12.5px] text-ink-2">Now: {current.title}</div>}
        </div>
        <div className="tnum text-[24px] font-light text-ink">{fmtClock(rem)}</div>
      </motion.div>
    </Link>
  );
}

function ExamSpotlight({ item, index }: { item: Item; index: number }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const c = item.courseId ? courseMap.get(item.courseId) : undefined;
  const color = colorOf(c?.color);
  const days = daysUntil(item.due, now);
  const { total, done, ratio } = progressOf(item);
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => ui.openItem(item.id)}
      className="relative overflow-hidden rounded-xl border p-4 text-left"
      style={{ borderColor: color.bg, background: `linear-gradient(135deg, ${color.bg}, transparent 70%)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: color.fg }}>
            <GraduationCap className="h-3.5 w-3.5" />
            {c?.code || c?.name || "Exam"}
          </div>
          <div className="mt-1 truncate text-[16px] font-semibold text-ink">{item.title}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">
            {format(item.due, "EEE MMM d")} · {fmtTime(item.due)}
            {item.where ? ` · ${item.where}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum text-[30px] font-bold leading-none" style={{ color: color.fg }}>
            {Math.max(0, days)}
          </div>
          <div className="text-[11px] text-ink-3">{days === 1 ? "day" : "days"}</div>
        </div>
      </div>
      <div className="mt-4">
        {total < 2 ? (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            Plan how you&apos;ll study <ArrowRight className="h-3.5 w-3.5" />
          </div>
        ) : (
          <>
            <div className="mb-1.5 flex justify-between text-[12px] text-ink-3">
              <span>Study plan</span>
              <span className="tnum">
                {done}/{total}
              </span>
            </div>
            <Bar value={ratio} color={color.dot} height={6} />
          </>
        )}
      </div>
    </motion.button>
  );
}

function UpNext({ item }: { item: Item }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const c = item.courseId ? courseMap.get(item.courseId) : undefined;
  const { current } = nextSubtasks(item);
  const { total, done, ratio } = progressOf(item);
  return (
    <section>
      <SectionTitle>Up next</SectionTitle>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-panel p-4">
        <button onClick={() => ui.openItem(item.id)} className="block w-full text-left">
          <div className="flex items-center gap-2 text-[12.5px]">
            {c && <Tag color={c.color}>{c.code || c.name}</Tag>}
            <DueText item={item} now={now} />
          </div>
          <div className="mt-1.5 text-[18px] font-semibold leading-snug text-ink">{item.title}</div>
          {current ? (
            <div className="mt-1 text-[13.5px] text-ink-2">Next step: {current.title || "Untitled step"}</div>
          ) : (
            <div className="mt-1 text-[13.5px] text-ink-3">Break it into a few small steps to get going.</div>
          )}
          {total > 0 && <Bar value={ratio} height={4} className="mt-3" color={ratio >= 1 ? "var(--good)" : "var(--accent)"} />}
          {total > 0 && (
            <div className="tnum mt-1 text-[11.5px] text-ink-3">
              {done} of {total} steps
            </div>
          )}
        </button>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} onClick={() => ui.requestStart(item.id)}>
            Start
          </Button>
          <Button variant="secondary" onClick={() => ui.openItem(item.id)}>
            Open
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

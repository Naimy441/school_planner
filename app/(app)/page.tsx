"use client";

import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, CalendarPlus, ChevronDown, ChevronRight, Link2, Pause, Play, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMarkAttendance } from "@/components/class-gate";
import { ProgressSection } from "@/components/progress";
import { ClassRow, ItemRow, Meta, whenText } from "@/components/rows";
import { useToggleSubtask } from "@/components/subtasks";
import { useTick } from "@/components/timer-engine";
import { Bar, Button, Card, Check, IconButton, Page, Ring, SectionTitle } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { phaseMs, remainingOf } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { addDays, dayKey, dayLabel, daysUntil, fmtClock, greeting } from "@/lib/dates";
import { isOverdue, isVisible, meetingSummary, nextSubtasks, progressOf, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ClassSession, Item } from "@/lib/types";

const WEEK = 7;

export default function Home() {
  const { user, items, sessions, attendance, courses, now, ready, timer } = useStore();
  const markAtt = useMarkAttendance();
  const [showLater, setShowLater] = useState(false);
  const today = dayKey(now);
  const first = user?.displayName?.split(" ")[0];
  const focusing = !!timer?.active;

  const visible = useMemo(() => items.filter((i) => isVisible(i, now)), [items, now]);
  const top = useMemo(() => workQueue(items, now)[0], [items, now]);
  // The hero card's item still appears in its list (tagged "Up next") so lists are complete.
  const heroId = focusing ? timer?.itemId : top?.id;
  // Exams within a week get their own strip (and aren't repeated in the lists).
  const exams = useMemo(
    () => visible.filter((i) => i.kind === "exam" && i.due > now && daysUntil(i.due, now) <= 7).sort((a, b) => a.due - b.due),
    [visible, now],
  );
  const examIds = useMemo(() => new Set(exams.map((e) => e.id)), [exams]);

  const todayClasses = sessions.filter((s) => s.date === today && s.end > now && !attendance.has(s.id));
  const todayItems = visible
    .filter((i) => !examIds.has(i.id) && (dayKey(i.due) === today || isOverdue(i, now)))
    .sort((a, b) => Number(isOverdue(a, now)) - Number(isOverdue(b, now)) || a.due - b.due);

  const week = useMemo(() => {
    const map = new Map<string, { classes: ClassSession[]; items: Item[] }>();
    const get = (k: string) => map.get(k) || (map.set(k, { classes: [], items: [] }), map.get(k)!);
    const end = addDays(today, WEEK);
    for (const s of sessions) if (s.date > today && s.date <= end && !attendance.has(s.id)) get(s.date).classes.push(s);
    for (const i of visible) {
      const k = dayKey(i.due);
      if (!examIds.has(i.id) && k > today && k <= end && !isOverdue(i, now)) get(k).items.push(i);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v, items: v.items.sort((a, b) => a.due - b.due) }));
  }, [sessions, visible, attendance, today, now, examIds]);

  const later = visible.filter((i) => dayKey(i.due) > addDays(today, WEEK) && !isOverdue(i, now)).sort((a, b) => a.due - b.due);

  return (
    <Page>
      <div className="text-[13px] font-medium text-ink-3">{format(now, "EEEE, MMMM d")}</div>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
        {greeting(new Date(now))}
        {first ? `, ${first}` : ""}
      </h1>

      <div className="mt-6 flex flex-col gap-8">
        {!ready ? (
          <div className="shimmer h-40 rounded-xl" />
        ) : !courses.length && !items.length ? (
          <Welcome />
        ) : focusing ? (
          <FocusingCard />
        ) : top ? (
          <DoNext item={top} />
        ) : (
          <Card className="flex items-center gap-3 p-5">
            <Sparkles className="h-5 w-5 text-good" />
            <div className="text-[15px] text-ink-2">Nothing waiting on you. Enjoy it.</div>
          </Card>
        )}

        {ready && exams.length > 0 && <ExamsSoon exams={exams} />}

        {ready && (todayClasses.length > 0 || todayItems.length > 0) && (
          <section>
            <SectionTitle>Today</SectionTitle>
            <Card className="p-1">
              <AnimatePresence initial={false}>
                {todayClasses.map((s) => (
                  <ClassRow key={s.id} s={s} onCheckIn={() => markAtt(s, "attended")} />
                ))}
                {todayItems.map((i) => (
                  <ItemRow key={i.id} item={i} timeOnly={!isOverdue(i, now)} upNext={i.id === heroId} />
                ))}
              </AnimatePresence>
            </Card>
          </section>
        )}

        {ready &&
          week.map((d) => (
            <section key={d.date}>
              <SectionTitle>{dayLabel(d.date, now)}</SectionTitle>
              <Card className="p-1">
                <AnimatePresence initial={false}>
                  {d.classes.map((s) => (
                    <ClassRow key={s.id} s={s} />
                  ))}
                  {d.items.map((i) => (
                    <ItemRow key={i.id} item={i} timeOnly upNext={i.id === heroId} />
                  ))}
                </AnimatePresence>
              </Card>
            </section>
          ))}

        {ready && later.length > 0 && (
          <section className="-mt-3">
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
                      <ItemRow key={i.id} item={i} upNext={i.id === heroId} />
                    ))}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {ready && courses.length > 0 && <Classes />}

        {ready && <ProgressSection />}
      </div>
    </Page>
  );
}

/** Every class, one tap from Home — opens its page (schedule, links, textbook, work). */
function Classes() {
  const { courses, attendance } = useStore();
  const ui = useUI();
  return (
    <section>
      <SectionTitle
        right={
          <div className="-my-1 flex items-center gap-1">
            <button onClick={() => ui.setImportOpen(true)} className="rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink-2">
              Import .ics
            </button>
            <IconButton label="Add a class" onClick={() => ui.setNewCourse(true)}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
        }
      >
        Classes
      </SectionTitle>
      <Card className="p-1">
        {courses.map((c) => {
          const att = [...attendance.values()].filter((a) => a.courseId === c.id);
          const a = att.filter((x) => x.status === "attended").length;
          const m = att.filter((x) => x.status === "missed").length;
          const links = c.links?.length || 0;
          return (
            <button
              key={c.id}
              onClick={() => ui.openCourse(c.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-hover active:bg-press"
            >
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c.color).dot }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] text-ink">{c.name}</div>
                <Meta
                  parts={[
                    c.code,
                    c.meetings[0] && meetingSummary(c.meetings[0]),
                    c.meetings.length > 1 && `+${c.meetings.length - 1}`,
                    a + m > 0 && `${Math.round((a / (a + m)) * 100)}% attended`,
                  ]}
                />
              </div>
              {links > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-[12px] text-ink-3" aria-label={`${links} link${links > 1 ? "s" : ""}`}>
                  <Link2 className="h-3.5 w-3.5" />
                  {links}
                </span>
              )}
              {c.textbook.kind !== "none" && <BookOpen className="h-4 w-4 shrink-0 text-ink-3" aria-label="Has textbook" />}
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
            </button>
          );
        })}
      </Card>
    </section>
  );
}

function ExamsSoon({ exams }: { exams: Item[] }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  return (
    <section>
      <SectionTitle>Exams soon</SectionTitle>
      <Card className="p-1">
        {exams.map((e) => {
          const c = e.courseId ? courseMap.get(e.courseId) : undefined;
          const color = colorOf(c?.color);
          const d = daysUntil(e.due, now);
          const { total, ratio } = progressOf(e);
          return (
            <button key={e.id} onClick={() => ui.openItem(e.id)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-hover">
              <span className="tnum flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg leading-none" style={{ background: color.bg, color: color.fg }}>
                <span className="text-[15px] font-bold">{Math.max(0, d)}</span>
                <span className="text-[8.5px] font-semibold uppercase">{d === 1 ? "day" : "days"}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] text-ink">{e.title}</div>
                {total < 2 ? (
                  <div className="mt-0.5 text-[12.5px] font-medium text-accent">Plan how you&apos;ll study →</div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Bar value={ratio} height={4} color={color.dot} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </Card>
    </section>
  );
}

function Welcome() {
  const ui = useUI();
  return (
    <Card className="p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <CalendarPlus className="h-5 w-5" />
      </div>
      <div className="mt-4 text-[17px] font-semibold text-ink">Start with your classes</div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-3">
        Import your timetable once. Then add exams and assignments with the + button — everything shows up here.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => ui.setImportOpen(true)}>
          Import .ics
        </Button>
        <Button variant="ghost" onClick={() => ui.setNewCourse(true)}>
          Add by hand
        </Button>
      </div>
    </Card>
  );
}

/** The single most important thing, with its next step right there. */
function DoNext({ item }: { item: Item }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const toggle = useToggleSubtask();
  const c = item.courseId ? courseMap.get(item.courseId) : undefined;
  const { current } = nextSubtasks(item);
  const { total, done, ratio } = progressOf(item);
  const examDays = item.kind === "exam" ? daysUntil(item.due, now) : null;

  return (
    <section>
      <SectionTitle>Do this next</SectionTitle>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-panel p-4 sm:p-5">
        <button onClick={() => ui.openItem(item.id)} className="block w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[18px] font-semibold leading-snug text-ink">{item.title}</div>
              <Meta parts={[c?.code || c?.name, whenText(item, now)]} warm={isOverdue(item, now)} />
            </div>
            {examDays != null && examDays <= 7 && (
              <div className="shrink-0 text-right" style={{ color: colorOf(c?.color).fg }}>
                <div className="tnum text-[26px] font-bold leading-none">{Math.max(0, examDays)}</div>
                <div className="text-[11px] text-ink-3">{examDays === 1 ? "day" : "days"}</div>
              </div>
            )}
          </div>
        </button>

        {current ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-hover px-3 py-2.5">
            <Check checked={false} round={false} size={20} onChange={(_, e) => toggle(item, current, e)} label={current.title} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Next step</div>
              <div className="truncate text-[14.5px] text-ink">{current.title || "Untitled step"}</div>
            </div>
          </div>
        ) : (
          <button onClick={() => ui.openItem(item.id)} className="mt-4 w-full rounded-lg border border-dashed border-line-2 px-3 py-2.5 text-left text-[14px] text-ink-2 hover:bg-hover">
            {total ? "All steps done — open it to wrap up" : "Break it into a few small steps →"}
          </button>
        )}

        {total > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <Bar value={ratio} height={4} color={ratio >= 1 ? "var(--good)" : "var(--accent)"} />
            <span className="tnum shrink-0 text-[11.5px] text-ink-3">
              {done}/{total}
            </span>
          </div>
        )}

        <Button variant="primary" size="lg" className="mt-4 w-full" icon={<Play className="h-4 w-4" />} onClick={() => ui.requestStart(item.id)}>
          Start
        </Button>
      </motion.div>
    </section>
  );
}

function FocusingCard() {
  const { timer, itemMap } = useStore();
  const now = useTick(1000);
  const item = timer?.itemId ? itemMap.get(timer.itemId) : undefined;
  if (!timer?.active || !item) return null;
  const rem = remainingOf(timer, now);
  const isWork = timer.phase === "work";
  const color = isWork ? "var(--accent)" : "var(--good)";
  const { current } = nextSubtasks(item);
  return (
    <section>
      <SectionTitle>Right now</SectionTitle>
      <Link href="/focus">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.99 }}
          className="flex items-center gap-4 rounded-xl border p-4"
          style={{ borderColor: isWork ? "rgba(35,131,226,0.35)" : "rgba(79,174,126,0.35)", background: isWork ? "var(--accent-soft)" : "var(--good-soft)" }}
        >
          <Ring value={1 - rem / phaseMs(timer)} size={48} stroke={4} color={color} spin>
            {timer.endsAt == null ? <Pause className="h-4 w-4 text-ink" /> : <Play className="h-4 w-4 fill-current text-ink" />}
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
              {timer.endsAt == null ? "Paused" : isWork ? "Focusing" : "Break"}
            </div>
            <div className="truncate text-[15px] font-medium text-ink">{item.title}</div>
            {current && <div className="truncate text-[12.5px] text-ink-2">{current.title}</div>}
          </div>
          <div className="tnum text-[24px] font-light text-ink">{fmtClock(rem)}</div>
        </motion.div>
      </Link>
    </section>
  );
}

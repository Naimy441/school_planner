"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleSlash, Clock, Flame, ListChecks, Play, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useMarkAttendance } from "@/components/class-gate";
import { ClassRow, DueText, ItemRow, rowMotion } from "@/components/rows";
import { useToggleSubtask } from "@/components/subtasks";
import { AnimatedNumber, Button, Card, Check, Empty, Page, Ring, SectionTitle, Tag } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { colorOf } from "@/lib/colors";
import { dayKey, daysUntil, fmtDuration, fmtTime } from "@/lib/dates";
import { nextSubtasks, streakOf, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { Item } from "@/lib/types";
import { format } from "date-fns";

export default function TodayPage() {
  const { items, sessions, attendance, days, settings, now, ready, courseMap } = useStore();
  const markAtt = useMarkAttendance();
  const today = dayKey(now);
  const stat = days.get(today);
  const pts = stat?.points || 0;
  const goal = settings.dailyGoal;

  const queue = useMemo(() => workQueue(items, now), [items, now]);
  const soon = queue.filter((i) => daysUntil(i.due, now) <= 7 || i.due < now);
  const laterCount = queue.length - soon.length;
  const [first, ...rest] = soon;
  const todaysClasses = sessions.filter((s) => s.date === today);
  const doneToday = items
    .filter((i) => i.status === "done" && i.completedAt && dayKey(i.completedAt) === today)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const streak = streakOf(days, today);

  return (
    <Page>
      <div className="text-[13px] font-medium text-ink-3">{format(now, "EEEE, MMMM d")}</div>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[34px]">Today</h1>

      {/* daily goal */}
      <Card className="mt-6 flex items-center gap-5 p-5">
        <Ring value={pts / goal} size={84} stroke={8} color={pts >= goal ? "var(--good)" : "var(--gold)"}>
          <div className="flex flex-col items-center leading-none">
            <AnimatedNumber value={pts} className="text-[20px] font-bold text-ink" />
            <span className="mt-0.5 text-[10px] text-ink-3">/ {goal}</span>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">
            {pts >= goal ? "Daily goal reached 🎉" : pts > 0 ? `${goal - pts} points to today's goal` : "Let's get the first points on the board"}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {fmtDuration(stat?.focusMs || 0)} focus
            </span>
            <span className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> {stat?.subtasks || 0} steps
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-warn" /> {streak} day streak
            </span>
          </div>
        </div>
      </Card>

      {/* classes */}
      {todaysClasses.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Classes</SectionTitle>
          <Card className="p-1">
            {todaysClasses.map((s) => {
              const a = attendance.get(s.id);
              if (!a) return <ClassRow key={s.id} s={s} onCheckIn={() => markAtt(s, "attended")} />;
              const c = courseMap.get(s.courseId);
              return (
                <motion.div key={s.id} {...rowMotion} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 opacity-60">
                  <div className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: colorOf(c?.color).dot }} />
                  <div className="tnum w-[58px] shrink-0 text-[13px] text-ink-2">{fmtTime(s.start)}</div>
                  <div className="min-w-0 flex-1 truncate text-[14.5px] text-ink-2">{c?.name}</div>
                  {a.status === "attended" ? (
                    <span className="flex items-center gap-1 text-[12px] text-good">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Attended
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[12px] text-ink-3">
                      <CircleSlash className="h-3.5 w-3.5" /> {a.status === "missed" ? "Missed" : "Skipped"}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </Card>
        </section>
      )}

      {/* do this first */}
      <section className="mt-8">
        <SectionTitle>{first ? "Do this first" : "Your queue"}</SectionTitle>
        {!ready ? (
          <div className="shimmer h-28 rounded-xl" />
        ) : first ? (
          <FirstUp item={first} />
        ) : (
          <Empty icon={<Sparkles />} title="Nothing on your plate" body="Enjoy it — or add something with the + button." />
        )}
      </section>

      {rest.length > 0 && (
        <section className="mt-6">
          <SectionTitle>Then</SectionTitle>
          <Card className="p-1">
            <AnimatePresence initial={false}>
              {rest.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </AnimatePresence>
          </Card>
          {laterCount > 0 && <p className="mt-2 px-2.5 text-[12.5px] text-ink-3">+{laterCount} more due later — they&apos;ll show up here when it&apos;s time.</p>}
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Done today</SectionTitle>
          <Card className="p-1">
            <AnimatePresence initial={false}>
              {doneToday.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </AnimatePresence>
          </Card>
        </section>
      )}
    </Page>
  );
}

function FirstUp({ item }: { item: Item }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const toggle = useToggleSubtask();
  const c = item.courseId ? courseMap.get(item.courseId) : undefined;
  const { current, upcoming } = nextSubtasks(item);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-panel p-4">
      <button className="block w-full text-left" onClick={() => ui.openItem(item.id)}>
        <div className="flex items-center gap-2 text-[12.5px]">
          {c && <Tag color={c.color}>{c.code || c.name}</Tag>}
          <DueText item={item} now={now} />
        </div>
        <div className="mt-1.5 text-[18px] font-semibold text-ink">{item.title}</div>
      </button>
      <div className="mt-3 flex flex-col gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {[current, upcoming].filter(Boolean).map((s, idx) => (
            <motion.div
              key={s!.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: idx === 0 ? 1 : 0.6, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 rounded-lg px-1 py-1.5"
            >
              <Check checked={false} round={false} size={20} onChange={(_, e) => toggle(item, s!, e)} />
              <span className="truncate text-[14.5px] text-ink">{s!.title || "Untitled step"}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!current && <p className="text-[13.5px] text-ink-3">No steps yet — open it and break it down.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} onClick={() => ui.requestStart(item.id)}>
          Start
        </Button>
        <Button variant="secondary" onClick={() => ui.openItem(item.id)}>
          Open
        </Button>
      </div>
    </motion.div>
  );
}

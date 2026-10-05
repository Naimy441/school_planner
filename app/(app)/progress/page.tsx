"use client";

import { motion } from "motion/react";
import { CalendarCheck, CheckCircle2, Clock, Flame, ListChecks, Trophy } from "lucide-react";
import { useMemo } from "react";
import { AnimatedNumber, Bar, Card, Dot, Page, Ring, SectionTitle } from "@/components/ui";
import { colorOf } from "@/lib/colors";
import { addDays, dayKey, dueLabel, fmtDuration, parseDay, WEEKDAYS_SHORT } from "@/lib/dates";
import { levelInfo, levelTitle } from "@/lib/points";
import { streakOf } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { format } from "date-fns";

export default function ProgressPage() {
  const { profile, days, items, courses, attendance, now, settings } = useStore();
  const lvl = levelInfo(profile.points);
  const today = dayKey(now);

  const streak = streakOf(days, today);

  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)), [today]);
  const maxFocus = Math.max(30 * 60_000, ...last14.map((d) => days.get(d)?.focusMs || 0));
  const todayPts = days.get(today)?.points || 0;
  const weekPoints = last14.slice(7).reduce((s, d) => s + (days.get(d)?.points || 0), 0);

  const attended = profile.classesAttended;
  const missed = profile.classesMissed;
  const attRate = attended + missed ? attended / (attended + missed) : 0;

  const perCourse = courses.map((c) => {
    const list = [...attendance.values()].filter((a) => a.courseId === c.id);
    const a = list.filter((x) => x.status === "attended").length;
    const m = list.filter((x) => x.status === "missed").length;
    return { c, a, m, rate: a + m ? a / (a + m) : 0 };
  });

  const recent = items
    .filter((i) => i.status === "done" && i.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 8);

  return (
    <Page>
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[34px]">Progress</h1>

      {/* level */}
      <Card className="relative mt-6 overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(232,181,74,0.18),transparent_70%)]" />
        <div className="relative flex items-center gap-5">
          <Ring value={lvl.progress} size={92} stroke={8} color="var(--gold)">
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-3">Level</span>
              <span className="text-[28px] font-bold text-gold">{lvl.level}</span>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-gold">{levelTitle(lvl.level)}</div>
            <div className="mt-0.5 text-[28px] font-bold leading-none text-ink">
              <AnimatedNumber value={profile.points} /> <span className="text-[14px] font-normal text-ink-3">points</span>
            </div>
            <Bar value={lvl.progress} color="var(--gold)" height={7} className="mt-3" />
            <div className="mt-1.5 text-[12px] text-ink-3">
              {lvl.toNext} to level {lvl.level + 1} · {weekPoints} this week
            </div>
          </div>
        </div>
      </Card>

      {/* stat tiles */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat icon={<Clock className="h-4 w-4 text-accent" />} label="Focus time" text={fmtDuration(profile.focusMs)} />
        <Stat icon={<CheckCircle2 className="h-4 w-4 text-good" />} label="Tasks done" value={profile.itemsDone} />
        <Stat icon={<ListChecks className="h-4 w-4 text-ink-2" />} label="Steps done" value={profile.subtasksDone} />
      </div>

      {/* today + streak */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-4">
          <Ring value={todayPts / settings.dailyGoal} size={56} stroke={5} color={todayPts >= settings.dailyGoal ? "var(--good)" : "var(--gold)"}>
            <AnimatedNumber value={todayPts} className="text-[14px] font-bold text-ink" />
          </Ring>
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold text-ink">
              {todayPts >= settings.dailyGoal ? "Today's goal reached 🎉" : `${settings.dailyGoal - todayPts} points to today's goal`}
            </div>
            <div className="text-[12.5px] text-ink-3">{streak ? `${streak} day${streak > 1 ? "s" : ""} in a row` : "Get one point today to start a streak"}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-between gap-1.5">
          {last14.slice(7).map((d, i) => {
            const on = (days.get(d)?.points || 0) > 0;
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 18 }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border"
                  style={{
                    background: on ? "var(--warn-soft)" : "transparent",
                    borderColor: on ? "rgba(224,134,79,0.5)" : "var(--line)",
                  }}
                >
                  {on ? <Flame className="h-4 w-4 text-warn" /> : <span className="h-1 w-1 rounded-full bg-ink-3" />}
                </motion.div>
                <span className={d === today ? "text-[11px] font-semibold text-ink" : "text-[11px] text-ink-3"}>{WEEKDAYS_SHORT[parseDay(d).getDay()]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* focus chart */}
      <section className="mt-8">
        <SectionTitle>Focus · last 14 days</SectionTitle>
        <Card className="p-4">
          <div className="flex h-36 items-end gap-1.5">
            {last14.map((d, i) => {
              const v = days.get(d)?.focusMs || 0;
              return (
                <div key={d} className="group relative flex h-full flex-1 flex-col justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(v ? 4 : 2, (v / maxFocus) * 100)}%` }}
                    transition={{ delay: i * 0.03, type: "spring", stiffness: 120, damping: 18 }}
                    className="w-full rounded-[4px]"
                    style={{ background: v ? (d === today ? "var(--accent)" : "rgba(35,131,226,0.55)") : "rgba(255,255,255,0.06)" }}
                  />
                  <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-card-2 px-1.5 py-0.5 text-[11px] text-ink group-hover:block">
                    {fmtDuration(v)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink-3">
            <span>{format(parseDay(last14[0]), "MMM d")}</span>
            <span>Today</span>
          </div>
        </Card>
      </section>

      {/* attendance */}
      <section className="mt-8">
        <SectionTitle>Attendance</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring value={attRate} size={64} stroke={6} color="var(--good)">
              <span className="text-[15px] font-bold text-ink">{attended + missed ? Math.round(attRate * 100) : "–"}</span>
            </Ring>
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <CalendarCheck className="h-4 w-4 text-good" /> {attended} classes attended
              </div>
              <div className="text-[12.5px] text-ink-3">{missed ? `${missed} missed — every class is a fresh start` : "Perfect so far"}</div>
            </div>
          </div>
          {perCourse.some((p) => p.a + p.m > 0) && (
            <div className="mt-5 flex flex-col gap-3">
              {perCourse
                .filter((p) => p.a + p.m > 0)
                .map(({ c, a, m, rate }) => (
                  <div key={c.id}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 text-ink">
                        <Dot color={c.color} /> {c.code || c.name}
                      </span>
                      <span className="tnum text-ink-3">
                        {a}/{a + m}
                      </span>
                    </div>
                    <Bar value={rate} color={colorOf(c.color).dot} height={5} />
                  </div>
                ))}
            </div>
          )}
        </Card>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Recently completed</SectionTitle>
          <Card className="p-1">
            {recent.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <Trophy className="h-4 w-4 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{i.title}</span>
                <span className="shrink-0 text-[12px] text-ink-3">{dueLabel(i.completedAt!, now)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </Page>
  );
}

function Stat({ icon, label, value, text }: { icon: React.ReactNode; label: string; value?: number; text?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[24px] font-bold text-ink">{text ?? <AnimatedNumber value={value || 0} />}</div>
    </Card>
  );
}

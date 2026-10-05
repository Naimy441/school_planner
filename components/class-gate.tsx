"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { markAttendance } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { dayLabel, fmtTime } from "@/lib/dates";
import { POINTS } from "@/lib/points";
import { currentSession, unmarkedPast } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { AttendanceStatus, ClassSession } from "@/lib/types";
import { celebrate } from "./celebrate";
import { useTick } from "./timer-engine";
import { Button, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function useMarkAttendance() {
  const { uid } = useStore();
  const { toast } = useUI();
  return (s: ClassSession, status: AttendanceStatus, e?: { clientX: number; clientY: number }) => {
    if (status === "attended") celebrate({ points: POINTS.classAttended, x: e?.clientX, y: e?.clientY });
    markAttendance(uid, s, status).catch(() => toast("Couldn't save attendance"));
  };
}

/** Full-screen "go to class" moment while a class is starting / in session. */
export function ClassGate() {
  const { sessions, attendance, courseMap } = useStore();
  const now = useTick(20_000);
  const mark = useMarkAttendance();
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const s = currentSession(sessions, attendance, now);
  const show = s && !(snoozed[s.id] && snoozed[s.id] > now);
  const c = s ? courseMap.get(s.courseId) : undefined;
  const color = colorOf(c?.color);
  const mins = s ? Math.round((s.start - now) / 60_000) : 0;

  return (
    <AnimatePresence>
      {show && s && c && (
        <motion.div
          key={s.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-app px-6 text-center"
        >
          <motion.div
            className="pointer-events-none absolute -top-1/3 left-1/2 h-[120vh] w-[120vh] -translate-x-1/2 rounded-full blur-[120px]"
            style={{ background: color.bg }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.1 }}
            className="relative flex max-w-[420px] flex-col items-center"
          >
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: color.bg, color: color.fg }}>
              <span className="pulse-ring absolute inset-0 rounded-3xl" style={{ color: color.dot }} />
              <CalendarCheck className="h-9 w-9" />
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: color.fg }}>
              {mins > 0 ? `Starts in ${mins} min` : mins === 0 ? "Starting now" : `Started ${-mins} min ago`}
            </div>
            <h1 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-ink">Time for {c.code || c.name}</h1>
            {c.code && <div className="mt-1 text-[15px] text-ink-2">{c.name}</div>}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14.5px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {fmtTime(s.start)} – {fmtTime(s.end)}
              </span>
              {s.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {s.location}
                </span>
              )}
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-ink-3">Head over now — showing up is half the work. Tap below once you&apos;re in your seat.</p>
            <Button variant="good" size="lg" className="mt-7 w-full max-w-[320px]" onClick={(e) => mark(s, "attended", e)}>
              I&apos;m in class · +{POINTS.classAttended}
            </Button>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSnoozed((x) => ({ ...x, [s.id]: Date.now() + 5 * 60_000 }))}>
                Remind me in 5 min
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mark(s, "skipped")}>
                Not going today
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** On open: gently ask about classes that ended while the app was closed. */
export function AttendancePrompt() {
  const { sessions, attendance, courseMap, ready, now } = useStore();
  const mark = useMarkAttendance();
  const [later, setLater] = useState(false);
  const pending = useMemo(() => unmarkedPast(sessions, attendance, courseMap, now), [sessions, attendance, courseMap, now]);
  const s = pending[pending.length - 1];
  const c = s ? courseMap.get(s.courseId) : undefined;
  const open = ready && !later && !!s && !!c;

  return (
    <Sheet open={open} onClose={() => setLater(true)} mode="center" label="Attendance check">
      {s && c && (
        <AnimatePresence mode="wait">
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            <div className="flex items-center justify-between text-[12px] text-ink-3">
              <span className="font-medium uppercase tracking-[0.12em]">Quick check-in</span>
              {pending.length > 1 && <span>{pending.length} to go</span>}
            </div>
            <h3 className="mt-3 text-[20px] font-semibold leading-snug text-ink">
              Did you make it to <span style={{ color: colorOf(c.color).fg }}>{c.code || c.name}</span>?
            </h3>
            <p className="mt-1.5 text-[14px] text-ink-2">
              {dayLabel(s.date, now)} · {fmtTime(s.start)}–{fmtTime(s.end)}
              {s.location ? ` · ${s.location}` : ""}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="good" size="lg" onClick={(e) => mark(s, "attended", e)}>
                Yes, I went
              </Button>
              <Button variant="secondary" size="lg" onClick={() => mark(s, "missed")}>
                I missed it
              </Button>
            </div>
            <p className="mt-4 text-center text-[12.5px] text-ink-3">Missing one is okay — honest tracking helps you spot patterns.</p>
          </motion.div>
        </AnimatePresence>
      )}
    </Sheet>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { CloudSun, Moon, MoonStar, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { markPrayer } from "@/lib/actions";
import { dayKey, dayLabel, fmtTime, MIN } from "@/lib/dates";
import { currentPrayer, inSleepWindow, PRAYER_LABEL, recentWindows, unansweredPast, type PrayerWindow } from "@/lib/prayer";
import { useStore } from "@/lib/store";
import type { PrayerName, PrayerStatus } from "@/lib/types";
import { useTick } from "./timer-engine";
import { Button, Sheet } from "./ui";
import { useUI } from "./ui-state";

export const PRAYER_ICON: Record<PrayerName, LucideIcon> = {
  fajr: Sunrise,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: Moon,
};

const SNOOZE_KEY = "prayer-snooze";
const SNOOZE = 15 * MIN;

function readSnoozes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Today's (and last night's) prayer windows, recomputed when the day or the settings change. */
export function usePrayerWindows(now: number) {
  const { settings } = useStore();
  const day = dayKey(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` stands in for `now`, so this recomputes once a day
  return useMemo(() => recentWindows(settings.prayer, now), [settings.prayer, day]);
}

export function useMarkPrayer() {
  const { uid, prayers } = useStore();
  const { toast } = useUI();
  return (w: PrayerWindow, status: PrayerStatus) => {
    const now = Date.now();
    markPrayer(uid, w, status, now >= w.start && now < w.end, prayers.get(w.id)?.status).catch(() => toast("Couldn't save — check your connection"));
  };
}

/**
 * The prayer check-in, like the class check-in: while it's a prayer's time it asks whether
 * you've prayed (with a snooze), and afterwards it asks about any that ended unanswered.
 */
export function PrayerCheck() {
  const { settings, prayers, prayersReady } = useStore();
  const now = useTick(30_000);
  const mark = useMarkPrayer();
  const windows = usePrayerWindows(now);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [later, setLater] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSnoozes(readSnoozes()), 0);
    return () => clearTimeout(t);
  }, []);

  /** `at` is the click time (passed in so this stays a plain handler) */
  const snooze = (id: string, at: number) => {
    const next = { ...snoozes, [id]: at + SNOOZE };
    // keep only live snoozes
    for (const k of Object.keys(next)) if (next[k] < at) delete next[k];
    setSnoozes(next);
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
    } catch {}
  };

  const current = currentPrayer(windows, prayers, now);
  const showCurrent = !!current && !((snoozes[current.id] || 0) > now);
  const past = unansweredPast(windows, prayers, settings.prayer?.since ?? now, now);
  const w = showCurrent ? current : later ? null : past[past.length - 1];
  const open = prayersReady && !!w;
  const isNow = !!w && w === current;
  const Icon = w ? PRAYER_ICON[w.prayer] : Sun;

  return (
    <Sheet open={open} onClose={() => (isNow && w ? snooze(w.id, now) : setLater(true))} mode="center" label="Prayer check-in">
      {w && (
        <AnimatePresence mode="wait">
          <motion.div
            key={w.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            <div className="flex items-center justify-between text-[12px] text-ink-3">
              <span className="font-medium uppercase tracking-[0.12em]">{isNow ? "Prayer time" : "Quick check-in"}</span>
              {!isNow && past.length > 1 && <span>{past.length} to go</span>}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-good-soft text-good">
                {isNow && <span className="pulse-ring absolute inset-0 rounded-2xl text-good" />}
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[20px] font-semibold leading-snug text-ink">
                  {isNow ? `It's time for ${PRAYER_LABEL[w.prayer]}` : `Did you pray ${PRAYER_LABEL[w.prayer]}?`}
                </h3>
                <p className="text-[13.5px] text-ink-2">
                  {isNow
                    ? `Since ${fmtTime(w.start)} · until ${fmtTime(w.end)}`
                    : `${dayLabel(w.date, now)} · ${fmtTime(w.start)}–${fmtTime(w.end)}`}
                </p>
              </div>
            </div>
            {isNow ? (
              <>
                <Button variant="good" size="lg" className="mt-6 w-full" onClick={() => mark(w, "prayed")}>
                  I prayed
                </Button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => snooze(w.id, Date.now())}>
                    Not yet · 15 min
                  </Button>
                  <Button variant="ghost" onClick={() => mark(w, "excused")}>
                    Excused
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button variant="good" size="lg" onClick={() => mark(w, "prayed")}>
                    Yes, I prayed
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => mark(w, "missed")}>
                    I missed it
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => mark(w, "excused")}>
                  Excused
                </Button>
              </>
            )}
            <p className="mt-4 text-center text-[12.5px] text-ink-3">
              {isNow ? "Step away for a few minutes — your work will be right here." : "Honest tracking helps you see the pattern. Every prayer is a fresh start."}
            </p>
          </motion.div>
        </AnimatePresence>
      )}
    </Sheet>
  );
}

/** A gentle nudge when the app is opened between bedtime and wake-up. */
export function SleepReminder() {
  const { settings } = useStore();
  const now = useTick(60_000);
  const [ackedVisit, setAckedVisit] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);

  // "Goodnight" holds until the app is put away; opening it again later asks again.
  useEffect(() => {
    const onVis = () => document.visibilityState === "hidden" && setAckedVisit(false);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const sleep = settings.sleep;
  const open = inSleepWindow(sleep, now) && !ackedVisit && now >= snoozedUntil;

  return (
    <Sheet open={open} onClose={() => setAckedVisit(true)} mode="center" label="Bedtime">
      {sleep && (
        <div className="relative overflow-hidden p-6 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(130,120,230,0.22),transparent_70%)]" />
          <motion.div
            initial={{ rotate: -12, scale: 0.9, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
            className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(130,120,230,0.16)] text-[#a9a1f0]"
          >
            <MoonStar className="h-7 w-7" />
          </motion.div>
          <h3 className="relative mt-4 text-[20px] font-semibold text-ink">It&apos;s past your bedtime</h3>
          <p className="relative mx-auto mt-1.5 max-w-[320px] text-[14px] leading-relaxed text-ink-2">
            You planned to sleep at {fmtSettingTime(sleep.bed)} and wake at {fmtSettingTime(sleep.wake)}. Rest now — tomorrow&apos;s work goes better after
            a good night.
          </p>
          <Button variant="primary" size="lg" className="relative mt-6 w-full" onClick={() => setAckedVisit(true)}>
            Okay, goodnight
          </Button>
          <Button variant="ghost" size="sm" className="relative mt-2 w-full" onClick={() => setSnoozedUntil(Date.now() + 15 * MIN)}>
            Just 15 more minutes
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** "23:00" → "11:00 PM" in the user's locale. */
export function fmtSettingTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return fmtTime(d.getTime());
}

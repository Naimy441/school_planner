"use client";

import { AnimatePresence, motion } from "motion/react";
import { Coffee, FileText, Pause, Play, Plus, RotateCcw, SkipForward, SlidersHorizontal, Square, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { addSubtask, adjustTimer, advanceTimer, pauseTimer, phaseMs, remainingOf, resetTimer, resumeTimer, stopTimer } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { dayKey, fmtClock, fmtDuration } from "@/lib/dates";
import { nextSubtasks, progressOf } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { Item, TimerState } from "@/lib/types";
import { useCompleteItem } from "./rows";
import { PresetPicker } from "./start-flow";
import { useToggleSubtask } from "./subtasks";
import { useTick } from "./timer-engine";
import { Bar, Button, Check, cn, IconButton, Ring, Sheet, Tag } from "./ui";
import { useUI } from "./ui-state";

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const get = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [on]);
}

export function FocusView({ timer, item }: { timer: TimerState; item: Item }) {
  const { uid, courseMap, days } = useStore();
  const ui = useUI();
  const now = useTick(250);
  const complete = useCompleteItem();
  const toggle = useToggleSubtask();
  const [adjust, setAdjust] = useState(false);
  const [draft, setDraft] = useState("");
  const course = item.courseId ? courseMap.get(item.courseId) : undefined;
  const paused = timer.endsAt == null;
  const rem = Math.max(0, remainingOf(timer, now));
  const len = phaseMs(timer);
  const isWork = timer.phase === "work";
  const color = isWork ? "var(--accent)" : "var(--good)";
  const { current, upcoming, remaining } = nextSubtasks(item);
  const { total, done, ratio } = progressOf(item);
  const allDone = total > 0 && remaining === 0;
  const waiting = paused && timer.remainingMs === len;
  const todayFocus = days.get(dayKey(now))?.focusMs || 0;
  useWakeLock(!paused);

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    addSubtask(uid, item, t);
    setDraft("");
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-4 pb-24 pt-2 md:pt-10">
      {/* item header */}
      <button
        onClick={() => ui.openItem(item.id)}
        className="flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-[13.5px] text-ink-2 hover:bg-hover"
      >
        {course && <Tag color={course.color}>{course.code || course.name}</Tag>}
        <span className="truncate">{item.title}</span>
        <FileText className="h-3.5 w-3.5 shrink-0 text-ink-3" />
      </button>

      {/* ring */}
      <div className="relative mt-4 md:mt-6">
        <motion.div
          className="absolute inset-6 rounded-full blur-3xl"
          animate={{ background: isWork ? "rgba(35,131,226,0.18)" : "rgba(79,174,126,0.18)", opacity: paused ? 0.4 : 1 }}
          transition={{ duration: 0.8 }}
        />
        <div className="hidden md:block">
          <Ring value={1 - rem / len} size={300} stroke={8} color={color} spin>
            <Clock rem={rem} isWork={isWork} paused={paused} cycle={timer.cycle} big />
          </Ring>
        </div>
        <div className="md:hidden">
          <Ring value={1 - rem / len} size={248} stroke={7} color={color} spin>
            <Clock rem={rem} isWork={isWork} paused={paused} cycle={timer.cycle} />
          </Ring>
        </div>
      </div>

      {/* controls */}
      <div className="mt-6 flex items-center gap-4">
        <IconButton label="End session" className="h-11 w-11 rounded-full bg-hover" onClick={() => stopTimer(uid, timer)}>
          <Square className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={isWork ? "Restart this focus block" : "Restart this break"}
          className="h-11 w-11 rounded-full bg-hover"
          onClick={() => {
            const worked = isWork ? len - rem : 0;
            resetTimer(uid, timer).catch(() => ui.toast("Couldn't reset — check your connection"));
            ui.toast(worked >= 60_000 ? `Started over — your ${fmtDuration(worked)} still counts` : "Started over from the top");
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </IconButton>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => (paused ? resumeTimer(uid, timer) : pauseTimer(uid, timer))}
          className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          style={{ background: color }}
          aria-label={paused ? "Resume" : "Pause"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={paused ? "play" : "pause"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
              {paused ? <Play className="ml-0.5 h-6 w-6 fill-current" /> : <Pause className="h-6 w-6 fill-current" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <IconButton label="Skip to next phase" className="h-11 w-11 rounded-full bg-hover" onClick={() => advanceTimer(uid, timer, { skip: true })}>
          <SkipForward className="h-4 w-4" />
        </IconButton>
        <IconButton label="Change the rhythm" className="h-11 w-11 rounded-full bg-hover" onClick={() => setAdjust(true)}>
          <SlidersHorizontal className="h-4 w-4" />
        </IconButton>
      </div>
      <button onClick={() => setAdjust(true)} className="mt-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink-2">
        {timer.workMin}/{timer.breakMin} rhythm · {fmtDuration(todayFocus)} focused today
      </button>

      {waiting && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center text-[14px] text-ink-2">
          {isWork ? "Break's done. Ready when you are." : "That block is in the bag. Take your break when you're ready."}
        </motion.div>
      )}

      {/* steps */}
      <div className="mt-7 w-full">
        <AnimatePresence mode="popLayout" initial={false}>
          {allDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-good/30 bg-good-soft p-5 text-center"
            >
              <Trophy className="mx-auto h-7 w-7 text-good" />
              <div className="mt-2 text-[17px] font-semibold text-ink">Every step is done</div>
              <p className="mt-1 text-[13.5px] text-ink-2">
                {item.reward ? `Wrap it up and go enjoy: ${item.reward}` : "Wrap it up — you earned this one."}
              </p>
              <Button variant="good" size="lg" className="mt-4 w-full" onClick={(e) => complete(item, e)}>
                Complete “{item.title}”
              </Button>
            </motion.div>
          ) : current ? (
            <motion.div key="steps" layout className="flex flex-col gap-2">
              {!isWork && (
                <div className="mb-1 flex items-center gap-2.5 rounded-xl bg-good-soft px-4 py-3 text-[13.5px] text-[#bfe3cf]">
                  <Coffee className="h-4 w-4 shrink-0" />
                  Stand up, stretch, sip some water. Your next step will be right here.
                </div>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={current.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.96, transition: { duration: 0.22 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-4"
                >
                  <Check checked={false} size={30} onChange={(_, e) => toggle(item, current, e)} label={`Done: ${current.title}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Now</div>
                    <div className="mt-0.5 break-words text-[18px] font-medium leading-snug text-ink">{current.title || "Untitled step"}</div>
                  </div>
                </motion.div>
                {upcoming && (
                  <motion.div
                    key={upcoming.id + "-next"}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className="flex items-center gap-4 rounded-xl px-4 py-2.5"
                  >
                    <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-dashed border-ink-3" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Up next</div>
                      <div className="break-words text-[14.5px] text-ink-2">{upcoming.title || "Untitled step"}</div>
                    </div>
                    {remaining > 2 && <span className="text-[12px] text-ink-3">+{remaining - 2} more</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="empty" className="rounded-2xl border border-dashed border-line p-5 text-center text-[14px] text-ink-2">
              No steps yet — add the first tiny one below.
            </motion.div>
          )}
        </AnimatePresence>

        {total > 0 && (
          <div className="mt-5 px-1">
            <div className="mb-1.5 flex justify-between text-[12px] text-ink-3">
              <span>Progress</span>
              <span className="tnum">
                {done}/{total} steps
              </span>
            </div>
            <Bar value={ratio} height={6} color={ratio >= 1 ? "var(--good)" : colorOf(course?.color).dot} />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-app/60 px-3 py-1.5 focus-within:border-line-2">
          <Plus className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Thought of another step? Add it…"
            enterKeyHint="done"
            className="ghost-input h-9 text-[14.5px]"
          />
          {draft && (
            <Button size="sm" variant="subtle" onClick={add}>
              Add
            </Button>
          )}
        </div>
      </div>

      <Sheet open={adjust} onClose={() => setAdjust(false)} mode="center" label="Adjust rhythm">
        <PresetPicker
          initialWork={timer.workMin}
          initialRest={timer.breakMin}
          cta="Update"
          onStart={(w, r) => {
            adjustTimer(uid, timer, w, r);
            setAdjust(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function Clock({ rem, isWork, paused, cycle, big }: { rem: number; isWork: boolean; paused: boolean; cycle: number; big?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={isWork ? "w" : "b"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-[12px] font-semibold uppercase tracking-[0.18em]", isWork ? "text-accent" : "text-good")}
      >
        {paused ? "Paused" : isWork ? "Focus" : "Break"}
      </motion.div>
      <div className={cn("tnum mt-1 font-light tracking-tight text-ink", big ? "text-[68px]" : "text-[56px]", paused && "opacity-60")}>
        {fmtClock(rem)}
      </div>
      <div className="mt-0.5 text-[12px] text-ink-3">
        {cycle > 0 ? `${cycle} block${cycle > 1 ? "s" : ""} done` : "First block"}
      </div>
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import { ArrowRight, Lightbulb, Minus, Play, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { startTimer, stopTimer } from "@/lib/actions";
import { dueLabel } from "@/lib/dates";
import { effectiveDeadline, prepValid, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button, cn, Sheet, Tag } from "./ui";
import { useUI } from "./ui-state";

export const PRESETS = [
  { work: 10, rest: 3, label: "Warm-up" },
  { work: 20, rest: 10, label: "Easy" },
  { work: 25, rest: 5, label: "Classic" },
  { work: 50, rest: 10, label: "Deep" },
  { work: 60, rest: 15, label: "Hour" },
  { work: 120, rest: 30, label: "Marathon" },
];

type Step = "idle" | "nudge" | "prep" | "preset";

export function StartFlow() {
  const ui = useUI();
  const router = useRouter();
  const { items, itemMap, courseMap, now, uid, settings, timer } = useStore();
  const [acked, setAcked] = useState<string[]>([]);
  const id = ui.startFor;
  const item = id ? itemMap.get(id) : undefined;

  const top = useMemo(() => workQueue(items, now)[0], [items, now]);

  // What should happen for the item the user wants to start (pure).
  const step: Step = useMemo(() => {
    if (!id || !item) return "idle";
    if (top && top.id !== id && !acked.includes(id) && effectiveDeadline(top, now) < effectiveDeadline(item, now)) return "nudge";
    if (!prepValid(item, now) || !item.prep?.place || !item.prep?.distractions || !item.place || !item.subtasks.length) return "prep";
    return "preset";
  }, [id, item, top, acked, now]);

  useEffect(() => {
    if (!id) return;
    if (!itemMap.has(id)) ui.requestStart(null);
    else if (step === "prep") {
      ui.requestStart(null);
      ui.openItem(id);
      ui.toast("First: pick your spot, get there, and clear distractions");
    } else if (step === "preset") ui.openItem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, id]);

  const close = () => ui.requestStart(null);

  const topCourse = top?.courseId ? courseMap.get(top.courseId) : undefined;

  return (
    <>
      <Sheet open={step === "nudge" && !!top && !!item} onClose={close} mode="center" label="Priority check">
        {top && item && (
          <div className="p-6">
            <motion.div
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14 }}
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-gold"
            >
              <Lightbulb className="h-5 w-5" />
            </motion.div>
            <h3 className="text-[18px] font-semibold text-ink">Quick heads-up</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              Something else is due sooner. Knocking that out first usually makes everything after it feel lighter — but it&apos;s
              your call.
            </p>
            <div className="mt-4 rounded-lg border border-line bg-app/60 p-3">
              <div className="text-[14.5px] font-medium text-ink">{top.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
                {topCourse && <Tag color={topCourse.color}>{topCourse.code || topCourse.name}</Tag>}
                {dueLabel(effectiveDeadline(top, now), now)}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => {
                  setAcked((a) => [...a, top.id]);
                  ui.requestStart(top.id);
                }}
              >
                Switch to this one
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setAcked((a) => [...a, item.id])}
              >
                Continue with “{item.title}”
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={step === "preset" && !!item} onClose={close} mode="center" label="Choose a rhythm">
        {item && (
          <PresetPicker
            title={item.title}
            initialWork={settings.workMin}
            initialRest={settings.breakMin}
            busyWith={timer?.active && timer.itemId !== item.id ? itemMap.get(timer.itemId || "")?.title : undefined}
            onStart={async (w, r) => {
              // fire-and-forget: local snapshots update instantly, the server catches up
              if (timer?.active) stopTimer(uid, timer).catch(() => {});
              startTimer(uid, item.id, w, r).catch(() => ui.toast("Couldn't sync the timer"));
              ui.requestStart(null);
              router.push("/focus");
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function Stepper({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-line bg-app/60 py-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-1 flex items-center gap-3">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-hover text-ink-2 hover:text-ink"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={`Less ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="tnum w-14 text-center text-[22px] font-semibold text-ink">
          {value}
          <span className="text-[13px] font-normal text-ink-3">m</span>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-hover text-ink-2 hover:text-ink"
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`More ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PresetPicker({
  title,
  initialWork,
  initialRest,
  onStart,
  busyWith,
  cta = "Start",
}: {
  title?: string;
  initialWork: number;
  initialRest: number;
  onStart: (work: number, rest: number) => void | Promise<void>;
  busyWith?: string;
  cta?: string;
}) {
  const [work, setWork] = useState(initialWork);
  const [rest, setRest] = useState(initialRest);
  const [busy, setBusy] = useState(false);
  return (
    <div className="p-6">
      <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">Choose your rhythm</div>
      {title && <h3 className="mt-1 truncate text-[18px] font-semibold text-ink">{title}</h3>}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const on = p.work === work && p.rest === rest;
          return (
            <motion.button
              key={p.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setWork(p.work);
                setRest(p.rest);
              }}
              className={cn(
                "relative flex flex-col items-center rounded-lg border px-2 py-2.5 transition-colors",
                on ? "border-accent bg-accent-soft" : "border-line bg-app/60 hover:bg-hover",
              )}
            >
              <span className="tnum text-[15px] font-semibold text-ink">
                {p.work >= 60 ? `${p.work / 60}h` : p.work}
                <span className="text-ink-3">/</span>
                {p.rest}
              </span>
              <span className={cn("text-[11.5px]", on ? "text-accent" : "text-ink-3")}>{p.label}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Stepper label="Focus" value={work} onChange={setWork} min={1} max={240} step={work >= 30 ? 5 : 1} />
        <Stepper label="Break" value={rest} onChange={setRest} min={1} max={60} step={1} />
      </div>
      {busyWith && (
        <p className="mt-3 text-[12.5px] text-ink-3">This will wrap up your current session on “{busyWith}” (your focus time is saved).</p>
      )}
      <Button
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        disabled={busy}
        icon={<Play className="h-4 w-4" />}
        onClick={async () => {
          setBusy(true);
          try {
            await onStart(work, rest);
          } finally {
            setBusy(false);
          }
        }}
      >
        {cta} · {work} min
      </Button>
    </div>
  );
}

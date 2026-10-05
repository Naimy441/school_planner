"use client";

import { useState } from "react";
import { dueLabel, fmtTime, WEEKDAYS } from "@/lib/dates";
import { seriesOccurrences } from "@/lib/schedule";
import { cn, inputCls } from "./ui";

export interface RepeatValue {
  days: number[];
  time: string;
  start: string;
  end: string;
  lateDays: number;
}

export function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((d, i) => {
        const on = value.includes(i);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
            className={cn(
              "h-8 flex-1 rounded-md text-[12.5px] font-medium transition-colors",
              on ? "bg-accent text-white" : "bg-hover text-ink-3 hover:text-ink-2",
            )}
          >
            {d.slice(0, 2)}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[12px] text-ink-3">{hint}</div>}
    </label>
  );
}

const LATE_CHOICES = [
  { label: "No", days: 0 },
  { label: "1 day", days: 1 },
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

/** Days / time / range / late window, plus a plain-language preview. */
export function RepeatFields({ value, onChange }: { value: RepeatValue; onChange: (v: RepeatValue) => void }) {
  const [custom, setCustom] = useState(() => !LATE_CHOICES.some((c) => c.days === value.lateDays));
  const set = (patch: Partial<RepeatValue>) => onChange({ ...value, ...patch });
  return (
    <>
      <Field label="Due on">
        <DayPicker value={value.days} onChange={(days) => set({ days })} />
      </Field>
      <Field label="At">
        <input type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starting">
          <input type="date" value={value.start} onChange={(e) => set({ start: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Until">
          <input type="date" value={value.end} onChange={(e) => set({ end: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <Field label="Late work accepted">
        <div className="flex flex-wrap gap-1.5">
          {LATE_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                setCustom(false);
                set({ lateDays: c.days });
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
                !custom && value.lateDays === c.days ? "bg-accent text-white" : "bg-hover text-ink-2 hover:text-ink",
              )}
            >
              {c.label}
            </button>
          ))}
          {custom ? (
            <div className="flex h-8 items-center gap-1.5 rounded-md bg-accent pl-1 pr-2.5 text-[13px] font-medium text-white">
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={value.lateDays || ""}
                onChange={(e) => set({ lateDays: Math.min(60, +e.target.value.replace(/\D/g, "").slice(0, 2) || 0) })}
                aria-label="Days late work is accepted"
                className="h-6 w-10 rounded bg-white/20 text-center text-white outline-none"
              />
              days
            </div>
          ) : (
            <button type="button" onClick={() => setCustom(true)} className="h-8 rounded-md bg-hover px-3 text-[13px] font-medium text-ink-2 hover:text-ink">
              Custom
            </button>
          )}
        </div>
      </Field>
      <RepeatPreview value={value} />
    </>
  );
}

export function repeatOccurrences(v: RepeatValue) {
  if (!v.days.length || !v.time || !v.start || !v.end || v.start > v.end) return [];
  return seriesOccurrences(
    { id: "", courseId: "", title: "", days: v.days, time: v.time, startDate: v.start, endDate: v.end, lateDays: v.lateDays, createdAt: 0, active: true },
    v.start,
    v.end,
  );
}

/** Spells out what the weekly settings actually mean. */
function RepeatPreview({ value }: { value: RepeatValue }) {
  const occ = repeatOccurrences(value);
  if (!value.days.length) return <p className="text-[12.5px] text-warn">Pick at least one day.</p>;
  if (!occ.length) return <p className="text-[12.5px] text-warn">No due dates fall in that range — check the days or dates.</p>;
  const first = occ[0];
  const names = value.days.map((d) => WEEKDAYS[d]).join(" & ");
  const late = value.lateDays;
  return (
    <div className="rounded-lg border border-line bg-app/60 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
      <div>
        Due every <b className="font-medium text-ink">{names}</b> at {fmtTime(value.time)} — {occ.length} time{occ.length === 1 ? "" : "s"}.
      </div>
      <div>
        First one: <b className="font-medium text-ink">{dueLabel(first.due)}</b>
      </div>
      <div className="mt-1.5 text-ink-3">
        {late
          ? `Each one can be turned in late for ${late === 7 ? "a week" : `${late} day${late > 1 ? "s" : ""}`} — e.g. the first is accepted until ${dueLabel(first.lateDue!)}. After that we'll ask whether you turned it in.`
          : "Missed ones stay on your list (no pressure) until you finish or archive them."}
      </div>
    </div>
  );
}

export function repeatSummary(s: { days: number[]; time: string; lateDays?: number | null }) {
  const days = s.days.map((d) => WEEKDAYS[d]).join(", ");
  return `Every ${days} · ${fmtTime(s.time)}${s.lateDays ? ` · ${s.lateDays}-day late window` : ""}`;
}

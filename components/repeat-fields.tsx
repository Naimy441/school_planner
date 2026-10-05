"use client";

import { format } from "date-fns";
import { atTime, dayKey, fmtTime, WEEKDAYS } from "@/lib/dates";
import { lateOffsetOf, seriesOccurrences } from "@/lib/schedule";
import type { Series } from "@/lib/types";
import { cn, inputCls, SwitchRow } from "./ui";

export interface RepeatValue {
  days: number[];
  time: string;
  start: string;
  end: string;
  /** minutes after each due time that late work is accepted; null = none */
  lateOffsetMin: number | null;
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

const hhmm = (t: number) => format(t, "HH:mm");
export const when = (t: number) => `${format(t, "EEE, MMM d")} · ${fmtTime(t)}`;

export function repeatOccurrences(v: RepeatValue) {
  if (!v.days.length || !v.time || !v.start || !v.end || v.start > v.end) return [];
  return seriesOccurrences(
    { id: "", courseId: "", title: "", days: v.days, time: v.time, startDate: v.start, endDate: v.end, lateOffsetMin: v.lateOffsetMin, createdAt: 0, active: true },
    v.start,
    v.end,
  );
}

/** The next upcoming due date (or the first, if they're all in the past). */
export function nextOccurrence(v: RepeatValue) {
  const occ = repeatOccurrences(v);
  return occ.find((o) => o.due > Date.now()) || occ[0];
}

export function repeatError(v: RepeatValue) {
  if (!v.days.length) return "Pick at least one day.";
  if (!repeatOccurrences(v).length) return "No due dates fall between those dates.";
  if (v.lateOffsetMin != null && v.lateOffsetMin <= 0) return "The late deadline has to be after the due time.";
  return null;
}

export function RepeatFields({ value, onChange }: { value: RepeatValue; onChange: (v: RepeatValue) => void }) {
  const set = (patch: Partial<RepeatValue>) => onChange({ ...value, ...patch });
  const next = nextOccurrence(value);
  const late = next && value.lateOffsetMin != null ? next.due + value.lateOffsetMin * 60_000 : null;
  const error = repeatError(value);

  // Editing the late deadline of the next one sets the gap used for every week.
  const setLate = (date: string, time: string) => {
    if (!next || !date || !time) return;
    set({ lateOffsetMin: Math.round((atTime(date, time) - next.due) / 60_000) });
  };

  return (
    <>
      <Field label="Due every">
        <DayPicker value={value.days} onChange={(days) => set({ days })} />
      </Field>
      <Field label="Due at">
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

      <SwitchRow
        label="Accepts late work"
        checked={value.lateOffsetMin != null}
        onChange={(on) => set({ lateOffsetMin: on ? 3 * 1440 : null })}
      />
      {late != null && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Late deadline">
            <input type="date" value={dayKey(late)} onChange={(e) => setLate(e.target.value, hhmm(late))} className={inputCls} />
          </Field>
          <Field label="at">
            <input type="time" value={hhmm(late)} onChange={(e) => setLate(dayKey(late), e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      {error ? (
        <p className="text-[12.5px] text-warn">{error}</p>
      ) : (
        next && (
          <div className="rounded-lg border border-line bg-app/60 px-3 py-2.5 text-[13.5px]">
            <div className="flex justify-between gap-3">
              <span className="text-ink-3">Next due</span>
              <span className="text-ink">{when(next.due)}</span>
            </div>
            {late != null && (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-ink-3">Late deadline</span>
                <span className="text-ink">{when(late)}</span>
              </div>
            )}
          </div>
        )
      )}
    </>
  );
}

export function repeatSummary(s: Series) {
  const days = s.days.map((d) => WEEKDAYS[d]).join(", ");
  const offset = lateOffsetOf(s);
  let late = "";
  if (offset) {
    const occ = seriesOccurrences(s, dayKey(), s.endDate)[0];
    if (occ?.lateDue) late = ` · late until ${format(occ.lateDue, "EEE")} ${fmtTime(occ.lateDue)}`;
  }
  return `Every ${days} · ${fmtTime(s.time)}${late}`;
}

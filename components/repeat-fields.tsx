"use client";

import { format } from "date-fns";
import { atTime, dayKey, fmtTime, WEEKDAYS } from "@/lib/dates";
import { lateOffsetOf, seriesOccurrences } from "@/lib/schedule";
import type { Series } from "@/lib/types";
import { cn, inputCls, SwitchRow } from "./ui";

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

/** Date + time side by side, as one value in ms. */
export function DateTimeField({ label, value, onChange }: { label: string; value: number; onChange: (t: number) => void }) {
  const set = (date: string, time: string) => date && time && onChange(atTime(date, time));
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" aria-label={`${label} date`} value={dayKey(value)} onChange={(e) => set(e.target.value, hhmm(value))} className={inputCls} />
        <input type="time" aria-label={`${label} time`} value={hhmm(value)} onChange={(e) => set(dayKey(value), e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

export interface Schedule {
  /** the (first) due time, ms */
  due: number;
  repeat: boolean;
  /** last day it can repeat on, YYYY-MM-DD */
  until: string;
  /** late deadline for this (first) one, ms — later weeks keep the same gap */
  late: number | null;
}

export function scheduleError(s: Schedule) {
  if (Number.isNaN(s.due)) return "Pick a due date.";
  if (s.late != null && s.late <= s.due) return "The late deadline has to be after the due time.";
  if (s.repeat && (!s.until || s.until < dayKey(s.due))) return "“Until” has to be on or after the first due date.";
  return null;
}

/** Weekly rule fields for a schedule: same weekday and time as the first due date. */
export function toSeriesRule(s: Schedule) {
  return {
    days: [new Date(s.due).getDay()],
    time: hhmm(s.due),
    startDate: dayKey(s.due),
    endDate: s.until,
    lateOffsetMin: s.late != null ? Math.round((s.late - s.due) / 60_000) : null,
    lateDays: null,
  };
}

/** Due date (+ optional weekly repeat and late deadline). */
export function ScheduleFields({
  value,
  onChange,
  dueLabel = "Due",
  allowRepeat = false,
  allowLate = false,
  fixedRepeat = false,
}: {
  value: Schedule;
  onChange: (s: Schedule) => void;
  dueLabel?: string;
  allowRepeat?: boolean;
  allowLate?: boolean;
  /** editing an existing weekly assignment: no on/off switch */
  fixedRepeat?: boolean;
}) {
  const set = (patch: Partial<Schedule>) => onChange({ ...value, ...patch });
  const error = scheduleError(value);

  // Moving the due date carries the late deadline along with it.
  const setDue = (due: number) => set({ due, late: value.late != null ? due + (value.late - value.due) : null });

  return (
    <>
      <DateTimeField label={dueLabel} value={value.due} onChange={setDue} />

      {allowRepeat && !fixedRepeat && <SwitchRow label="Repeats every week" checked={value.repeat} onChange={(repeat) => set({ repeat })} />}
      {allowRepeat && value.repeat && (
        <Field label="Until" hint={`Every ${format(value.due, "EEEE")} at ${fmtTime(value.due)}`}>
          <input type="date" value={value.until} onChange={(e) => set({ until: e.target.value })} className={inputCls} />
        </Field>
      )}

      {allowLate && (
        <SwitchRow
          label="Accepts late work"
          checked={value.late != null}
          onChange={(on) => set({ late: on ? value.due + 3 * 86_400_000 : null })}
        />
      )}
      {allowLate && value.late != null && (
        <DateTimeField
          label={!value.repeat ? "Late deadline" : fixedRepeat ? "Late deadline (for the next one)" : "Late deadline (for this first one)"}
          value={value.late}
          onChange={(late) => set({ late })}
        />
      )}

      {error && <p className="text-[12.5px] text-warn">{error}</p>}
    </>
  );
}

/** "Every Mon · 11:59 PM · late until Thu 5 PM" */
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

/** The next upcoming occurrence of a weekly rule (or its last one). */
export function nextOfSeries(s: Series) {
  const upcoming = seriesOccurrences(s, dayKey(), s.endDate);
  if (upcoming.length) return upcoming.find((o) => o.due > Date.now()) || upcoming[0];
  const all = seriesOccurrences(s, s.startDate, s.endDate);
  return all[all.length - 1];
}

"use client";

import { useState } from "react";
import { createItem, saveSeries } from "@/lib/actions";
import { addDays, atTime, dayKey, dueLabel, fmtTime, fromLocalInput, parseDay, toLocalInput, WEEKDAYS } from "@/lib/dates";
import { seriesOccurrences } from "@/lib/schedule";
import { courseLabel } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { ItemKind } from "@/lib/types";
import { Button, cn, inputCls, Segmented, Sheet } from "./ui";
import { useUI, type NewItemDraft } from "./ui-state";

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

const LATE_CHOICES = [
  { label: "No", days: 0 },
  { label: "1 day", days: 1 },
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

/** Spells out what the weekly settings actually mean. */
function SeriesPreview({ days, time, start, end, lateDays }: { days: number[]; time: string; start: string; end: string; lateDays: number }) {
  if (!days.length || !time || !start || !end || start > end) return null;
  const occ = seriesOccurrences(
    { id: "", courseId: "", title: "", days, time, startDate: start, endDate: end, lateDays, createdAt: 0, active: true },
    start,
    end,
  );
  if (!occ.length) return <p className="text-[12.5px] text-warn">No due dates fall in that range — check the days or dates.</p>;
  const first = occ[0];
  const names = days.map((d) => WEEKDAYS[d]).join(" & ");
  return (
    <div className="rounded-lg border border-line bg-app/60 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
      <div>
        Due every <b className="font-medium text-ink">{names}</b> at {fmtTime(time)} — {occ.length} time{occ.length === 1 ? "" : "s"}.
      </div>
      <div>
        First one: <b className="font-medium text-ink">{dueLabel(first.due)}</b>
      </div>
      <div className="mt-1.5 text-ink-3">
        {lateDays
          ? `Each one can be turned in late for ${lateDays === 7 ? "a week" : `${lateDays} day${lateDays > 1 ? "s" : ""}`} — e.g. the first is accepted until ${dueLabel(first.lateDue!)}. After that it drops off your list.`
          : "Missed ones stay on your list (no pressure) until you finish or archive them."}
      </div>
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

export function NewItemSheet() {
  const ui = useUI();
  const open = !!ui.newItem;
  return (
    <Sheet open={open} onClose={() => ui.openNewItem(null)} mode="center" label="New">
      {/* draft is passed in so the form keeps rendering while the sheet animates closed */}
      {ui.newItem && <NewItemForm key={JSON.stringify(ui.newItem)} draft={ui.newItem} />}
    </Sheet>
  );
}

function NewItemForm({ draft }: { draft: NewItemDraft }) {
  const ui = useUI();
  const { uid, courses, courseMap } = useStore();
  const [kind, setKind] = useState<Exclude<ItemKind, "textbook">>(draft.kind === "textbook" ? "task" : draft.kind);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(draft.courseId || "");
  const today = dayKey();
  const [due, setDue] = useState(() => toLocalInput(draft.kind === "exam" ? atTime(addDays(today, 7), "09:00") : atTime(addDays(today, 1), "23:59")));
  const [hasLate, setHasLate] = useState(false);
  const [late, setLate] = useState(() => toLocalInput(atTime(addDays(today, 4), "23:59")));
  const [where, setWhere] = useState("");
  const [recurring, setRecurring] = useState(!!draft.recurring);
  const [days, setDays] = useState<number[]>([parseDay(today).getDay()]);
  const [time, setTime] = useState("23:59");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => {
    const last = courseMap.get(draft.courseId || "")?.meetings.map((m) => m.endDate).sort().pop();
    return last && last > today ? last : addDays(today, 7 * 14);
  });
  const [lateDays, setLateDays] = useState("");
  const [customLate, setCustomLate] = useState(false);
  const [busy, setBusy] = useState(false);

  const changeKind = (k: typeof kind) => {
    setKind(k);
    setDue(toLocalInput(k === "exam" ? atTime(addDays(today, 7), "09:00") : atTime(addDays(today, 1), "23:59")));
  };

  // default series range to the class's term
  const changeCourse = (id: string) => {
    setCourseId(id);
    const last = courseMap.get(id)?.meetings.map((m) => m.endDate).sort().pop();
    if (last && last > today) setEnd(last);
  };

  const canSave = title.trim() && (!recurring || (courseId && days.length && start <= end));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (kind === "assignment" && recurring) {
        await saveSeries(uid, {
          courseId,
          title: title.trim(),
          days,
          time,
          startDate: start,
          endDate: end,
          lateDays: lateDays ? Math.max(0, +lateDays) : null,
          createdAt: Date.now(),
          active: true,
        });
        ui.toast("Weekly assignment added — upcoming ones will appear automatically");
        ui.openNewItem(null);
      } else {
        const dueMs = fromLocalInput(due);
        const id = createItem(uid, {
          kind,
          title: title.trim(),
          courseId: courseId || null,
          due: dueMs,
          lateDue: kind === "assignment" && hasLate ? fromLocalInput(late) : null,
          where: kind === "exam" ? where.trim() || undefined : undefined,
        });
        ui.openNewItem(null);
        ui.openItem(id);
      }
    } catch {
      ui.toast("Couldn't save — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Segmented
        value={kind}
        onChange={changeKind}
        options={[
          { value: "assignment", label: "Assignment" },
          { value: "exam", label: "Exam" },
          { value: "task", label: "Task" },
        ]}
      />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "exam" ? "Midterm 1" : kind === "assignment" ? "Problem set 3" : "Email the TA"}
        className="ghost-input mt-5 text-[22px] font-semibold text-ink"
      />
      <div className="mt-5 flex flex-col gap-4">
        <Field label="Class">
          <select value={courseId} onChange={(e) => changeCourse(e.target.value)} className={inputCls}>
            <option value="">{kind === "task" ? "No class" : "Choose a class…"}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        {kind === "assignment" && (
          <label className="flex cursor-pointer items-center justify-between rounded-lg bg-hover px-3 py-2.5">
            <span className="text-[14px] text-ink">Repeats every week</span>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="h-4 w-4 accent-[#2383e2]" />
          </label>
        )}

        {kind === "assignment" && recurring ? (
          <>
            <Field label="Due on">
              <DayPicker value={days} onChange={setDays} />
            </Field>
            <Field label="At">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starting">
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Until">
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Late work accepted">
              <div className="flex flex-wrap gap-1.5">
                {LATE_CHOICES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      setCustomLate(false);
                      setLateDays(c.days ? String(c.days) : "");
                    }}
                    className={cn(
                      "h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
                      !customLate && (lateDays ? +lateDays : 0) === c.days ? "bg-accent text-white" : "bg-hover text-ink-2 hover:text-ink",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
                {customLate ? (
                  <div className="flex h-8 items-center gap-1.5 rounded-md bg-accent pl-1 pr-2.5 text-[13px] font-medium text-white">
                    <input
                      autoFocus
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={60}
                      value={lateDays}
                      onChange={(e) => setLateDays(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      aria-label="Days late work is accepted"
                      className="h-6 w-10 rounded bg-white/20 text-center text-white outline-none"
                    />
                    days
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustomLate(true)}
                    className="h-8 rounded-md bg-hover px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
                  >
                    Custom
                  </button>
                )}
              </div>
            </Field>
            <SeriesPreview days={days} time={time} start={start} end={end} lateDays={lateDays ? +lateDays : 0} />
            {!courseId && <p className="text-[12.5px] text-warn">Pick a class for weekly assignments.</p>}
          </>
        ) : (
          <>
            <Field label={kind === "exam" ? "Exam date & time" : "Due"}>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
            </Field>
            {kind === "exam" && (
              <Field label="Room">
                <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Hall B" className={inputCls} />
              </Field>
            )}
            {kind === "assignment" && (
              <>
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-hover px-3 py-2.5">
                  <span className="text-[14px] text-ink">Has a late deadline</span>
                  <input type="checkbox" checked={hasLate} onChange={(e) => setHasLate(e.target.checked)} className="h-4 w-4 accent-[#2383e2]" />
                </label>
                {hasLate && (
                  <Field
                    label="Late deadline"
                    hint={
                      Number.isNaN(fromLocalInput(late))
                        ? undefined
                        : `Late work is accepted until ${dueLabel(fromLocalInput(late))}. After that it quietly drops off your list.`
                    }
                  >
                    <input type="datetime-local" value={late} onChange={(e) => setLate(e.target.value)} className={inputCls} />
                  </Field>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => ui.openNewItem(null)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave || busy}>
          {kind === "assignment" && recurring ? "Add weekly" : "Create"}
        </Button>
      </div>
      {kind !== "task" && !recurring && (
        <p className="mt-3 text-right text-[12px] text-ink-3">Next, you&apos;ll break it into small steps.</p>
      )}
    </form>
  );
}

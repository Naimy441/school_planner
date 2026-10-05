"use client";

import { useState } from "react";
import { createItem, saveSeries } from "@/lib/actions";
import { addDays, atTime, dayKey, fromLocalInput, parseDay, toLocalInput, WEEKDAYS } from "@/lib/dates";
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
            <div className="grid grid-cols-3 gap-2">
              <Field label="Time">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="From">
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Until">
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Late deadline" hint="Days after each due date that late work is still accepted. Leave empty if none.">
              <input
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={lateDays}
                onChange={(e) => setLateDays(e.target.value)}
                placeholder="e.g. 3"
                className={inputCls}
              />
            </Field>
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
                  <Field label="Late deadline" hint="After this passes, the assignment quietly drops off your list.">
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

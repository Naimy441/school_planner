"use client";

import { useState } from "react";
import { createItem, saveSeries } from "@/lib/actions";
import { addDays, atTime, dayKey, dueLabel, fromLocalInput, parseDay, toLocalInput } from "@/lib/dates";
import { courseLabel } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { Course, ItemKind } from "@/lib/types";
import { Field, RepeatFields, repeatOccurrences, type RepeatValue } from "./repeat-fields";
import { Button, inputCls, Segmented, Sheet } from "./ui";
import { useUI, type NewItemDraft } from "./ui-state";

/** Last class day of the term, or ~14 weeks out. */
export function termEnd(course: Course | undefined, today: string) {
  const last = course?.meetings.map((m) => m.endDate).sort().pop();
  return last && last > today ? last : addDays(today, 7 * 14);
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
  const [repeat, setRepeat] = useState<RepeatValue>(() => ({
    days: [parseDay(today).getDay()],
    time: "23:59",
    start: today,
    end: termEnd(courseMap.get(draft.courseId || ""), today),
    lateDays: 0,
  }));
  const [busy, setBusy] = useState(false);

  const changeKind = (k: typeof kind) => {
    setKind(k);
    setDue(toLocalInput(k === "exam" ? atTime(addDays(today, 7), "09:00") : atTime(addDays(today, 1), "23:59")));
  };

  // default series range to the class's term
  const changeCourse = (id: string) => {
    setCourseId(id);
    setRepeat((r) => ({ ...r, end: termEnd(courseMap.get(id), today) }));
  };

  const canSave = title.trim() && (!recurring || (courseId && repeatOccurrences(repeat).length > 0));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (kind === "assignment" && recurring) {
        await saveSeries(uid, {
          courseId,
          title: title.trim(),
          days: repeat.days,
          time: repeat.time,
          startDate: repeat.start,
          endDate: repeat.end,
          lateDays: repeat.lateDays || null,
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
            <RepeatFields value={repeat} onChange={setRepeat} />
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

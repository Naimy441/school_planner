"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { createItem, saveSeries } from "@/lib/actions";
import { addDays, atTime, dayKey, fmtTime } from "@/lib/dates";
import { seriesItemId, sessionsBetween } from "@/lib/schedule";
import { courseLabel } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { Course, ItemKind } from "@/lib/types";
import { Field, ScheduleFields, scheduleError, toSeriesRule, type Schedule } from "./repeat-fields";
import { Button, inputCls, Segmented, Sheet, SwitchRow } from "./ui";
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

function defaultDue(kind: ItemKind, today: string) {
  return kind === "exam" ? atTime(addDays(today, 7), "09:00") : atTime(addDays(today, 1), "23:59");
}

function NewItemForm({ draft }: { draft: NewItemDraft }) {
  const ui = useUI();
  const { uid, courses, courseMap, now } = useStore();
  const [kind, setKind] = useState<Exclude<ItemKind, "textbook">>(draft.kind === "textbook" ? "task" : draft.kind);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(draft.courseId || "");
  const [where, setWhere] = useState("");
  const today = dayKey();
  const [schedule, setSchedule] = useState<Schedule>(() => ({
    due: defaultDue(draft.kind, today),
    repeat: !!draft.recurring,
    until: termEnd(courseMap.get(draft.courseId || ""), today),
    late: null,
  }));
  const [busy, setBusy] = useState(false);
  const [classSession, setClassSession] = useState<string | null>(null);
  const isAssignment = kind === "assignment";
  const course = courseMap.get(courseId);
  // Upcoming meetings of the chosen class, for "exam during class".
  const meetings = useMemo(() => {
    if (!course) return [];
    return sessionsBetween([course], today, addDays(today, 180)).filter((m) => m.start > now).slice(0, 40);
  }, [course, today, now]);

  const pickSession = (id: string | null) => {
    setClassSession(id);
    const m = meetings.find((x) => x.id === id);
    if (!m) return;
    setSchedule((s) => ({ ...s, due: m.start }));
    setWhere(m.location || course?.location || "");
  };
  const weekly = isAssignment && schedule.repeat;

  const changeKind = (k: typeof kind) => {
    setKind(k);
    setClassSession(null);
    setSchedule((s) => ({ ...s, due: defaultDue(k, today), late: null, repeat: k === "assignment" && s.repeat }));
  };

  // default the repeat range to the class's term
  const changeCourse = (id: string) => {
    setCourseId(id);
    setClassSession(null);
    setSchedule((s) => ({ ...s, until: termEnd(courseMap.get(id), today) }));
  };

  const canSave = !!title.trim() && !scheduleError(schedule) && (!weekly || !!courseId);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (weekly) {
        const id = await saveSeries(uid, {
          courseId,
          title: title.trim(),
          ...toSeriesRule(schedule),
          createdAt: Date.now(),
          active: true,
        });
        ui.openNewItem(null);
        // open the first week's copy (generated automatically) to break it down
        ui.openItem(seriesItemId(id, dayKey(schedule.due)));
      } else {
        const id = createItem(uid, {
          kind,
          title: title.trim(),
          courseId: courseId || null,
          due: schedule.due,
          lateDue: isAssignment ? schedule.late : null,
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
        placeholder={kind === "exam" ? "Midterm 1" : isAssignment ? "Problem set 3" : "Email the TA"}
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

        {kind === "exam" && meetings.length > 0 && (
          <SwitchRow label="During class" checked={classSession != null} onChange={(on) => pickSession(on ? meetings[0].id : null)} />
        )}
        {kind === "exam" && classSession != null ? (
          <Field label="Which class">
            <select value={classSession} onChange={(e) => pickSession(e.target.value)} className={inputCls}>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {format(m.start, "EEE, MMM d")} · {fmtTime(m.start)} – {fmtTime(m.end)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <ScheduleFields
            value={schedule}
            onChange={setSchedule}
            dueLabel={kind === "exam" ? "Exam" : "Due"}
            allowRepeat={isAssignment}
            allowLate={isAssignment}
          />
        )}
        {weekly && !courseId && <p className="text-[12.5px] text-warn">Pick a class for weekly assignments.</p>}

        {kind === "exam" && (
          <Field label="Room">
            <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Hall B" className={inputCls} />
          </Field>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => ui.openNewItem(null)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave || busy}>
          Create
        </Button>
      </div>
    </form>
  );
}

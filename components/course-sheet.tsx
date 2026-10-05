"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check as CheckIcon, Plus, Repeat, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteCourse, saveCourse, shortId, stopSeries } from "@/lib/actions";
import { COLOR_KEYS, colorOf } from "@/lib/colors";
import { addDays, dayKey } from "@/lib/dates";
import { isVisible } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ColorKey, Course, Meeting, TextbookKind } from "@/lib/types";
import { DayPicker, Field, repeatSummary } from "./repeat-fields";
import { ItemRow } from "./rows";
import { Bar, Button, IconButton, inputCls, Segmented, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function CourseSheetHost() {
  const ui = useUI();
  const { courseMap } = useStore();
  const course = ui.courseId ? courseMap.get(ui.courseId) : undefined;
  const open = !!course || ui.newCourse;
  const close = () => {
    ui.openCourse(null);
    ui.setNewCourse(false);
  };
  return (
    <Sheet open={open} onClose={close} label="Class">
      {open && <CourseForm key={course?.id || "new"} course={course} onClose={close} />}
    </Sheet>
  );
}

export function blankMeeting(): Meeting {
  const today = dayKey();
  return {
    id: shortId(),
    days: [1, 3],
    start: "10:00",
    end: "10:50",
    startDate: today,
    endDate: addDays(today, 7 * 15),
    interval: 1,
  };
}

function CourseForm({ course, onClose }: { course?: Course; onClose: () => void }) {
  const { uid, items, series, attendance, now } = useStore();
  const ui = useUI();
  const isNew = !course;
  const [draft, setDraft] = useState<Omit<Course, "id">>(() =>
    course
      ? { ...course }
      : {
          name: "",
          code: "",
          color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
          location: "",
          textbook: { kind: "none" },
          meetings: [blankMeeting()],
          createdAt: Date.now(),
          source: "manual",
        },
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Omit<Course, "id">>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setMeeting = (id: string, patch: Partial<Meeting>) =>
    set({ meetings: draft.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const color = colorOf(draft.color);

  const courseItems = useMemo(
    () => (course ? items.filter((i) => i.courseId === course.id && isVisible(i, now)).sort((a, b) => a.due - b.due) : []),
    [items, course, now],
  );
  const exams = courseItems.filter((i) => i.kind === "exam");
  const work = courseItems.filter((i) => i.kind !== "exam");
  const courseSeries = course ? series.filter((s) => s.courseId === course.id && s.active) : [];
  const att = course ? [...attendance.values()].filter((a) => a.courseId === course.id) : [];
  const attended = att.filter((a) => a.status === "attended").length;
  const missed = att.filter((a) => a.status === "missed").length;
  const rate = attended + missed ? attended / (attended + missed) : 0;

  /** Write a draft. Reading tasks start from the day a textbook is first added. */
  const persist = async (d: Omit<Course, "id">) => {
    const textbook = { ...d.textbook };
    if (textbook.kind !== "none" && !textbook.since) textbook.since = dayKey();
    if (textbook.kind === "none") delete textbook.since;
    return saveCourse(uid, { ...d, name: d.name.trim(), textbook, id: course?.id });
  };
  const persistRef = useRef(persist);
  const pending = useRef<Omit<Course, "id"> | null>(null);
  useEffect(() => {
    persistRef.current = persist;
    pending.current = !isNew && dirty && draft.name.trim() ? draft : null;
  });

  // Existing classes save themselves (Notion-style) shortly after each edit…
  useEffect(() => {
    if (isNew || !dirty || !draft.name.trim()) return;
    const t = setTimeout(() => {
      setSaving(true);
      persistRef.current(draft)
        .then(() => setDirty(false))
        .catch(() => ui.toast("Couldn't save — check your connection"))
        .finally(() => setSaving(false));
    }, 600);
    return () => clearTimeout(t);
  }, [draft, dirty, isNew, ui]);

  // …and anything still pending is saved when the panel closes.
  useEffect(
    () => () => {
      if (pending.current) persistRef.current(pending.current).catch(() => {});
    },
    [],
  );

  const create = async () => {
    if (!draft.name.trim()) return ui.toast("Give your class a name");
    setSaving(true);
    try {
      const id = await persist(draft);
      setDirty(false);
      ui.setNewCourse(false);
      ui.openCourse(id);
      ui.toast("Class added");
    } catch {
      ui.toast("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-full pb-4">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-panel/90 px-4 py-2 backdrop-blur-md sm:px-6">
        <span className="text-[13px] text-ink-3">
          {isNew ? "New class" : saving ? "Saving…" : dirty ? "Editing…" : "Class · saved"}
        </span>
        <IconButton label="Close" onClick={onClose}>
          <X className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
      <div className="px-5 sm:px-10">
        <div className="mb-3 mt-2 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: color.bg }}>
          <BookOpen className="h-6 w-6" style={{ color: color.fg }} />
        </div>
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Class name"
          autoFocus={isNew}
          className="ghost-input text-[26px] font-bold tracking-tight text-ink sm:text-[30px]"
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Code">
            <input value={draft.code || ""} onChange={(e) => set({ code: e.target.value })} placeholder="CS 101" className={inputCls} />
          </Field>
          <Field label="Usual room">
            <input value={draft.location || ""} onChange={(e) => set({ location: e.target.value })} placeholder="Hall A" className={inputCls} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => set({ color: k as ColorKey })}
              aria-label={k}
              className="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: colorOf(k).dot }}
            >
              {draft.color === k && <CheckIcon className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>

        {/* schedule */}
        <h3 className="mb-2 mt-8 text-[15px] font-semibold text-ink">Schedule</h3>
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {draft.meetings.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-line bg-app/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      value={m.label || ""}
                      onChange={(e) => setMeeting(m.id, { label: e.target.value })}
                      placeholder="Lecture"
                      className="ghost-input text-[14px] font-medium text-ink"
                    />
                    <IconButton label="Remove time" onClick={() => set({ meetings: draft.meetings.filter((x) => x.id !== m.id) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  <DayPicker value={m.days} onChange={(days) => setMeeting(m.id, { days })} />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Starts">
                      <input type="time" value={m.start} onChange={(e) => setMeeting(m.id, { start: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Ends">
                      <input type="time" value={m.end} onChange={(e) => setMeeting(m.id, { end: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="First day">
                      <input type="date" value={m.startDate} onChange={(e) => setMeeting(m.id, { startDate: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Last day">
                      <input type="date" value={m.endDate} onChange={(e) => setMeeting(m.id, { endDate: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="mt-2">
                    <Field label="Room (if different)">
                      <input
                        value={m.location || ""}
                        onChange={(e) => setMeeting(m.id, { location: e.target.value })}
                        placeholder={draft.location || "Room"}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <Button variant="ghost" size="sm" className="self-start" icon={<Plus className="h-4 w-4" />} onClick={() => set({ meetings: [...draft.meetings, blankMeeting()] })}>
            Add a meeting time
          </Button>
        </div>

        {/* textbook */}
        <h3 className="mb-1 mt-8 text-[15px] font-semibold text-ink">Textbook</h3>
        <p className="mb-3 text-[12.5px] text-ink-3">With a textbook, a “read & take notes” task appears on each class day — managed for you.</p>
        <Segmented<TextbookKind>
          value={draft.textbook.kind}
          onChange={(kind) => set({ textbook: { ...draft.textbook, kind } })}
          options={[
            { value: "none", label: "None" },
            { value: "physical", label: "Physical" },
            { value: "link", label: "Online" },
            { value: "file", label: "File" },
          ]}
        />
        {draft.textbook.kind !== "none" && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-col gap-3">
            <Field label="Title">
              <input
                value={draft.textbook.title || ""}
                onChange={(e) => set({ textbook: { ...draft.textbook, title: e.target.value } })}
                placeholder="Campbell Biology, 12th ed."
                className={inputCls}
              />
            </Field>
            {draft.textbook.kind !== "physical" && (
              <Field label={draft.textbook.kind === "file" ? "Link to the file" : "Link"} hint={draft.textbook.kind === "file" ? "A Drive / Dropbox / iCloud link to your PDF works great." : undefined}>
                <input
                  type="url"
                  value={draft.textbook.url || ""}
                  onChange={(e) => set({ textbook: { ...draft.textbook, url: e.target.value } })}
                  placeholder="https://"
                  className={inputCls}
                />
              </Field>
            )}
          </motion.div>
        )}

        {!isNew && course && (
          <>
            {/* attendance */}
            <h3 className="mb-2 mt-8 text-[15px] font-semibold text-ink">Attendance</h3>
            {attended + missed ? (
              <div className="rounded-xl border border-line bg-app/50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[22px] font-semibold text-ink">{Math.round(rate * 100)}%</span>
                  <span className="text-[12.5px] text-ink-3">
                    {attended} attended · {missed} missed
                  </span>
                </div>
                <Bar value={rate} color={color.dot} height={6} />
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Check in at your next class to start tracking.</p>
            )}

            {/* exams */}
            <div className="mb-1 mt-8 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">Exams</h3>
              <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => ui.openNewItem({ kind: "exam", courseId: course.id })}>
                Exam
              </Button>
            </div>
            {exams.length ? exams.map((i) => <ItemRow key={i.id} item={i} showCourse={false} />) : <p className="px-1 text-[13px] text-ink-3">No exams added.</p>}

            {/* assignments */}
            <div className="mb-1 mt-8 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">Assignments</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={<Repeat className="h-3.5 w-3.5" />} onClick={() => ui.openNewItem({ kind: "assignment", courseId: course.id, recurring: true })}>
                  Weekly
                </Button>
                <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => ui.openNewItem({ kind: "assignment", courseId: course.id })}>
                  One-off
                </Button>
              </div>
            </div>
            {courseSeries.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-hover">
                <Repeat className="h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink">{s.title}</div>
                  <div className="text-[12px] text-ink-3">
                    {repeatSummary(s)}
                  </div>
                </div>
                <IconButton
                  label="Stop repeating"
                  onClick={() =>
                    confirm(`Stop “${s.title}” from repeating? Upcoming weeks you haven't started are removed.`) &&
                    stopSeries(uid, s, dayKey(), items)
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            ))}
            {work.map((i) => (
              <ItemRow key={i.id} item={i} showCourse={false} />
            ))}
            {!work.length && !courseSeries.length && <p className="px-1 text-[13px] text-ink-3">Nothing yet.</p>}

            <div className="mt-10 border-t border-line pt-4">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={async () => {
                  if (!confirm(`Delete ${course.name}? Its open tasks and weekly assignments go too.`)) return;
                  await deleteCourse(uid, course, items, series);
                  onClose();
                }}
              >
                Delete class
              </Button>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isNew && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="sticky bottom-0 z-20 mt-6 border-t border-line bg-panel/95 px-5 py-3 backdrop-blur-md"
          >
            <div className="flex items-center justify-end gap-2">
              <Button variant="primary" onClick={create} disabled={saving} className="w-full sm:w-auto">
                Create class
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

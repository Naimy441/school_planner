"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ClipboardList, FileText, ImageIcon, KeyRound, Link2, Repeat, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createItem, saveCourse, saveSeries, shortId, updateSettings } from "@/lib/actions";
import { COLOR_KEYS, courseLabel } from "@/lib/colors";
import { addDays, atTime, dayKey, fmtTime, fromLocalInput, parseDay, toLocalInput, WEEKDAYS } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { DEFAULT_AI_MODEL, readSyllabus, SyllabusError, type SyllabusResult } from "@/lib/syllabus";
import type { Course, CourseLink, Meeting, Textbook } from "@/lib/types";
import { normalizeUrl } from "./links-editor";
import { termEnd } from "./new-item";
import { Field } from "./repeat-fields";
import { Button, Check, cn, IconButton, inputCls, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function SyllabusSheetHost() {
  const ui = useUI();
  const open = ui.syllabusFor != null;
  return (
    <Sheet open={open} onClose={() => ui.openSyllabus(null)} mode="center" label="Read a syllabus">
      {open && <SyllabusFlow key={ui.syllabusFor} courseId={ui.syllabusFor || ""} onClose={() => ui.openSyllabus(null)} />}
    </Sheet>
  );
}

// ---------- turning the AI's answer into things to add ----------

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const cleanTime = (t: string | null | undefined) => (t && HHMM.test(t.trim()) ? t.trim().padStart(5, "0") : null);
const cleanDate = (d: string | null | undefined) => (d && YMD.test(d.trim()) ? d.trim() : null);
const cleanDays = (d: number[]) => [...new Set(d.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface Pick {
  key: string;
  on: boolean;
  kind: "exam" | "assignment";
  title: string;
  /** ms, or NaN when the syllabus didn't give a date */
  due: number;
  where?: string;
  notes?: string;
  /** why it starts unticked */
  flag?: string;
}

interface WeeklyPick {
  key: string;
  on: boolean;
  title: string;
  days: number[];
  time: string;
}

function meetingsFrom(r: SyllabusResult, today: string): Meeting[] {
  const startDate = cleanDate(r.course.term_start) || today;
  const endDate = cleanDate(r.course.term_end) || addDays(today, 7 * 15);
  return r.course.meetings
    .map((m) => ({ ...m, days: cleanDays(m.days), start: cleanTime(m.start), end: cleanTime(m.end) }))
    .filter((m) => m.days.length && m.start && m.end)
    .map((m) => ({
      id: shortId(),
      days: m.days,
      start: m.start!,
      end: m.end!,
      startDate,
      endDate: endDate > startDate ? endDate : addDays(startDate, 7 * 15),
      interval: 1,
      ...(m.location ? { location: m.location } : {}),
      ...(m.label ? { label: m.label } : {}),
    }));
}

function linksFrom(r: SyllabusResult): CourseLink[] {
  const out: CourseLink[] = [];
  for (const l of r.course.links) {
    const url = normalizeUrl(l.url || "");
    if (url && !out.some((x) => x.url === url)) out.push({ id: shortId(), url, ...(l.title ? { title: l.title } : {}) });
  }
  return out;
}

function textbookFrom(r: SyllabusResult, today: string): Textbook | null {
  if (!r.course.textbook_title?.trim()) return null;
  const url = normalizeUrl(r.course.textbook_url || "");
  return { kind: url ? "link" : "physical", title: r.course.textbook_title.trim(), ...(url ? { url } : {}), since: today };
}

function picksFrom(r: SyllabusResult, meetings: Meeting[], existingTitles: Set<string>, now: number): Pick[] {
  const classStart = (date: string) => meetings.find((m) => m.days.includes(parseDay(date).getDay()))?.start;
  const flagOf = (title: string, due: number) =>
    existingTitles.has(norm(title)) ? "Already in your planner" : Number.isNaN(due) ? "No date given — pick one" : due < now ? "Already passed" : undefined;
  const exams: Pick[] = r.exams.map((e) => {
    const date = cleanDate(e.date);
    const time = cleanTime(e.time) || (date && (e.during_class || !e.time) ? classStart(date) : null) || "09:00";
    const due = date ? atTime(date, time) : NaN;
    const flag = flagOf(e.title, due);
    return { key: shortId(), on: !flag, kind: "exam", title: e.title.trim(), due, where: e.location || undefined, notes: e.notes || undefined, flag };
  });
  const work: Pick[] = r.assignments.map((a) => {
    const date = cleanDate(a.due_date);
    const due = date ? atTime(date, cleanTime(a.due_time) || "23:59") : NaN;
    const flag = flagOf(a.title, due);
    return { key: shortId(), on: !flag, kind: "assignment", title: a.title.trim(), due, notes: a.notes || undefined, flag };
  });
  return [...exams, ...work].filter((p) => p.title).sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
}

// ---------- the flow ----------

type Stage = "input" | "reading" | "review";

function SyllabusFlow({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { uid, courses, courseMap, items, settings, now } = useStore();
  const ui = useUI();
  const [stage, setStage] = useState<Stage>("input");
  const [target, setTarget] = useState<string>(courseId && courseMap.has(courseId) ? courseId : "new");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyllabusResult | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [weekly, setWeekly] = useState<WeeklyPick[]>([]);
  const [details, setDetails] = useState({ schedule: true, textbook: true, links: true, room: true });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const key = settings.openaiKey || "";
  const course = target === "new" ? undefined : courseMap.get(target);
  const today = dayKey(now);

  const addFiles = (list: FileList | File[]) => {
    const add = [...list].filter((f) => f.size > 0);
    const big = add.find((f) => f.size > 30_000_000);
    if (big) return ui.toast(`“${big.name}” is too big — try a smaller PDF or a few screenshots`);
    setFiles((cur) => [...cur, ...add].slice(0, 12));
  };

  // Screenshots can be pasted straight in.
  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = [...e.clipboardData.files];
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `Screenshot ${files.length + i + 1}.png`, { type: f.type }))));
    }
  };

  const run = async () => {
    setError("");
    setStage("reading");
    abort.current = new AbortController();
    try {
      const r = await readSyllabus({
        apiKey: key,
        model: settings.openaiModel,
        files,
        text,
        className: course ? courseLabel(course) : undefined,
        signal: abort.current.signal,
      });
      // A class the syllabus names that you already have is picked for you.
      let t = target;
      if (t === "new") {
        const code = norm(r.course.code || "");
        const name = norm(r.course.name || "");
        const match = courses.find((c) => (code && norm(c.code || "") === code) || (name && norm(c.name) === name) || (code && norm(c.name).includes(code)));
        if (match) t = match.id;
        setTarget(t);
      }
      const tCourse = t === "new" ? undefined : courseMap.get(t);
      const extracted = meetingsFrom(r, today);
      const titles = new Set(items.filter((i) => tCourse && i.courseId === tCourse.id && i.status !== "archived").map((i) => norm(i.title)));
      setResult(r);
      setNewName(r.course.name || r.course.code || "New class");
      setPicks(picksFrom(r, tCourse?.meetings.length ? tCourse.meetings : extracted, titles, Date.now()));
      setWeekly(
        r.weekly_assignments
          .map((w) => ({ key: shortId(), on: true, title: w.title.trim(), days: cleanDays(w.days), time: cleanTime(w.time) || "23:59" }))
          .filter((w) => w.title && w.days.length),
      );
      setStage("review");
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setError(e instanceof SyllabusError ? e.message : "Something went wrong reading that. Try again?");
      setStage("input");
    }
  };

  const extracted = useMemo(() => (result ? { meetings: meetingsFrom(result, today), links: linksFrom(result), textbook: textbookFrom(result, today) } : null), [result, today]);

  const chosen = picks.filter((p) => p.on && !Number.isNaN(p.due));
  const chosenWeekly = weekly.filter((w) => w.on);
  const total = chosen.length + chosenWeekly.length;

  const addAll = async () => {
    if (!result || !extracted) return;
    setBusy(true);
    try {
      let id = target;
      let cls: Course | undefined = course;
      if (target === "new") {
        const draft: Omit<Course, "id"> = {
          name: newName.trim() || "New class",
          code: result.course.code || "",
          color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
          location: result.course.location || "",
          textbook: extracted.textbook || { kind: "none" },
          meetings: extracted.meetings,
          links: extracted.links,
          createdAt: Date.now(),
          source: "manual",
        };
        id = await saveCourse(uid, draft);
        cls = { ...draft, id };
      } else if (course) {
        // Only fill in what the class doesn't have yet — never overwrite your own edits.
        const next: Course = { ...course };
        if (details.schedule && !course.meetings.length && extracted.meetings.length) next.meetings = extracted.meetings;
        if (details.textbook && course.textbook.kind === "none" && extracted.textbook) next.textbook = extracted.textbook;
        if (details.room && !course.location && result.course.location) next.location = result.course.location;
        if (details.links && extracted.links.length) {
          const have = new Set((course.links || []).map((l) => l.url));
          next.links = [...(course.links || []), ...extracted.links.filter((l) => !have.has(l.url))];
        }
        if (JSON.stringify(next) !== JSON.stringify(course)) await saveCourse(uid, next);
        cls = next;
      }
      for (const p of chosen)
        createItem(uid, {
          kind: p.kind,
          title: p.title.trim() || (p.kind === "exam" ? "Exam" : "Assignment"),
          courseId: id,
          due: p.due,
          ...(p.where ? { where: p.where } : {}),
          ...(p.notes ? { notes: p.notes } : {}),
        });
      const until = cleanDate(result.course.term_end) || termEnd(cls, today);
      for (const w of chosenWeekly)
        await saveSeries(uid, {
          courseId: id,
          title: w.title.trim(),
          days: w.days,
          time: w.time,
          // Starts today unless today's time has already gone by.
          startDate: atTime(today, w.time) > Date.now() ? today : addDays(today, 1),
          endDate: until > today ? until : termEnd(cls, today),
          lateOffsetMin: null,
          createdAt: Date.now(),
          active: true,
        });
      ui.toast(total ? `Added ${total} thing${total > 1 ? "s" : ""} from the syllabus` : "Class updated from the syllabus");
      onClose();
      ui.openCourse(id);
    } catch {
      ui.toast("Couldn't save — check your connection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6" onPaste={stage === "input" ? onPaste : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[18px] font-semibold text-ink">Read a syllabus</h3>
            <p className="text-[12.5px] text-ink-3">AI finds the exams, deadlines, class times, textbook and links. You choose what to add.</p>
          </div>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {stage === "input" && (
        <div className="mt-5 flex flex-col gap-4">
          {!key && <KeySetup />}

          <Field label="Which class is it for?">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              <option value="new">A new class (from the syllabus)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          <DropZone onFiles={addFiles} />
          {files.length > 0 && (
            <div className="-mt-2 flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-hover px-2.5 py-1.5 text-[13px] text-ink">
                  {f.type.startsWith("image/") ? <ImageIcon className="h-4 w-4 shrink-0 text-ink-3" /> : <FileText className="h-4 w-4 shrink-0 text-ink-3" />}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-3">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded p-0.5 text-ink-3 hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Field label="Or paste the text">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Copy the schedule from the course site and paste it here…"
              className={cn(inputCls, "h-auto resize-y py-2 leading-relaxed")}
            />
          </Field>

          {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-[#f0c9a8]">{error}</p>}

          <Button variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />} disabled={!key || (!files.length && !text.trim())} onClick={run}>
            Read it
          </Button>
          <p className="-mt-2 text-center text-[11.5px] text-ink-3">Sent to OpenAI with your key · {settings.openaiModel || DEFAULT_AI_MODEL}</p>
        </div>
      )}

      {stage === "reading" && (
        <div className="mt-8 flex flex-col items-center pb-4 text-center">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"
          >
            <BookOpen className="h-7 w-7" />
          </motion.div>
          <div className="mt-4 text-[15px] font-medium text-ink">Reading your syllabus…</div>
          <p className="mt-1 text-[13px] text-ink-3">Usually 20–60 seconds. Longer PDFs take a bit more.</p>
          <div className="shimmer mt-5 h-2 w-48 rounded-full" />
          <Button
            variant="ghost"
            size="sm"
            className="mt-5"
            onClick={() => {
              abort.current?.abort();
              setStage("input");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {stage === "review" && result && extracted && (
        <div className="mt-5 flex flex-col gap-5">
          <Field label="Add to">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              <option value="new">A new class</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          {target === "new" ? (
            <div className="rounded-xl border border-line bg-app/50 p-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="ghost-input text-[16px] font-semibold text-ink" aria-label="Class name" />
              <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
                {extracted.meetings.map((m) => (
                  <li key={m.id}>
                    {m.label ? `${m.label} · ` : ""}
                    {m.days.map((d) => WEEKDAYS[d]).join(", ")} · {fmtTime(m.start)} – {fmtTime(m.end)}
                    {m.location ? ` · ${m.location}` : ""}
                  </li>
                ))}
                {result.course.location && !extracted.meetings.some((m) => m.location) && <li>Room · {result.course.location}</li>}
                {extracted.textbook && <li>Textbook · {extracted.textbook.title}</li>}
                {extracted.links.length > 0 && <li>{extracted.links.length} link{extracted.links.length > 1 ? "s" : ""}</li>}
                {!extracted.meetings.length && <li className="text-ink-3">No class times found — you can add them on the class page.</li>}
              </ul>
            </div>
          ) : (
            course && (
              <ClassDetails course={course} result={result} extracted={extracted} details={details} onChange={(d) => setDetails((cur) => ({ ...cur, ...d }))} />
            )
          )}

          <section>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <ClipboardList className="h-4 w-4 text-ink-3" /> Exams &amp; assignments
              </h4>
              {picks.length > 1 && (
                <button
                  className="text-[12.5px] text-ink-3 hover:text-ink-2"
                  onClick={() => {
                    const all = picks.every((p) => p.on || Number.isNaN(p.due));
                    setPicks((cur) => cur.map((p) => ({ ...p, on: !all && !Number.isNaN(p.due) })));
                  }}
                >
                  {picks.every((p) => p.on || Number.isNaN(p.due)) ? "Untick all" : "Tick all"}
                </button>
              )}
            </div>
            {picks.length ? (
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {picks.map((p) => (
                    <PickRow key={p.key} p={p} onChange={(patch) => setPicks((cur) => cur.map((x) => (x.key === p.key ? { ...x, ...patch } : x)))} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="px-1 text-[13px] text-ink-3">No dated exams or assignments found.</p>
            )}
          </section>

          {weekly.length > 0 && (
            <section>
              <h4 className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Repeat className="h-4 w-4 text-ink-3" /> Every week
              </h4>
              {weekly.map((w) => (
                <div key={w.key} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <Check checked={w.on} round={false} size={20} label={w.title} onChange={(on) => setWeekly((cur) => cur.map((x) => (x.key === w.key ? { ...x, on } : x)))} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[14px] text-ink">{w.title}</div>
                    <div className="text-[12px] text-ink-3">
                      Every {w.days.map((d) => WEEKDAYS[d]).join(", ")} · {fmtTime(w.time)}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-2 border-t border-line bg-panel/95 px-6 py-3 backdrop-blur-md">
            <Button variant="ghost" onClick={() => setStage("input")}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" disabled={busy} onClick={addAll}>
              {total ? `Add ${total} to ${target === "new" ? "a new class" : course ? course.code || course.name : "the class"}` : target === "new" ? "Create the class" : "Update the class"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PickRow({ p, onChange }: { p: Pick; onChange: (patch: Partial<Pick>) => void }) {
  const noDate = Number.isNaN(p.due);
  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-lg px-1 py-2">
      <span className="flex h-[30px] items-center">
        <Check checked={p.on && !noDate} round={false} size={20} label={p.title} onChange={(on) => !noDate && onChange({ on })} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0 rounded px-1.5 py-[1px] text-[10.5px] font-semibold uppercase", p.kind === "exam" ? "bg-accent-soft text-accent" : "bg-hover text-ink-2")}>
            {p.kind === "exam" ? "Exam" : "Due"}
          </span>
          <input value={p.title} onChange={(e) => onChange({ title: e.target.value })} className="ghost-input min-w-0 text-[14px] text-ink" aria-label="Title" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <input
            type="datetime-local"
            aria-label={`${p.title} date and time`}
            value={noDate ? "" : toLocalInput(p.due)}
            onChange={(e) => {
              const due = fromLocalInput(e.target.value);
              onChange({ due, ...(Number.isNaN(due) ? {} : { on: true, flag: undefined }) });
            }}
            className={cn(inputCls, "h-8 w-auto px-2 text-[13px]", noDate && "border-warn/50")}
          />
          {p.where && <span className="text-[12px] text-ink-3">{p.where}</span>}
          {p.flag && <span className="text-[12px] text-warn/85">{p.flag}</span>}
        </div>
        {p.notes && <div className="mt-0.5 break-words text-[12px] text-ink-3">{p.notes}</div>}
      </div>
    </motion.div>
  );
}

function ClassDetails({
  course,
  result,
  extracted,
  details,
  onChange,
}: {
  course: Course;
  result: SyllabusResult;
  extracted: { meetings: Meeting[]; links: CourseLink[]; textbook: Textbook | null };
  details: { schedule: boolean; textbook: boolean; room: boolean; links: boolean };
  onChange: (d: Partial<{ schedule: boolean; textbook: boolean; room: boolean; links: boolean }>) => void;
}) {
  const have = new Set((course.links || []).map((l) => l.url));
  const newLinks = extracted.links.filter((l) => !have.has(l.url));
  const rows = [
    !course.meetings.length && extracted.meetings.length > 0 && {
      k: "schedule" as const,
      icon: Repeat,
      text: `Class times · ${extracted.meetings.map((m) => `${m.days.map((d) => WEEKDAYS[d]).join("/")} ${fmtTime(m.start)}`).join(", ")}`,
    },
    course.textbook.kind === "none" && extracted.textbook && { k: "textbook" as const, icon: BookOpen, text: `Textbook · ${extracted.textbook.title}` },
    !course.location && result.course.location && { k: "room" as const, icon: BookOpen, text: `Room · ${result.course.location}` },
    newLinks.length > 0 && { k: "links" as const, icon: Link2, text: `${newLinks.length} new link${newLinks.length > 1 ? "s" : ""} · ${newLinks.map((l) => l.title || l.url).join(", ")}` },
  ].filter(Boolean) as { k: "schedule" | "textbook" | "room" | "links"; icon: typeof BookOpen; text: string }[];
  if (!rows.length) return null;
  return (
    <section>
      <h4 className="mb-1 text-[14px] font-semibold text-ink">Fill in the class</h4>
      {rows.map((r) => (
        <div key={r.k} className="flex items-start gap-3 rounded-lg px-1 py-1.5">
          <span className="flex h-[22px] items-center">
            <Check checked={details[r.k]} round={false} size={20} label={r.text} onChange={(on) => onChange({ [r.k]: on })} />
          </span>
          <span className="min-w-0 break-words text-[13.5px] text-ink-2">{r.text}</span>
        </div>
      ))}
    </section>
  );
}

function DropZone({ onFiles }: { onFiles: (f: FileList | File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "focus-ring flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-accent bg-accent-soft" : "border-line-2 hover:bg-hover",
      )}
    >
      <Upload className="h-5 w-5 text-ink-3" />
      <div className="mt-2 text-[14px] font-medium text-ink">Choose the syllabus</div>
      <div className="mt-0.5 text-[12.5px] text-ink-3">PDF, screenshots or photos — or drop / paste them here</div>
      <input
        ref={ref}
        type="file"
        multiple
        accept="application/pdf,.pdf,image/*,.txt,.md,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** One-time: paste your OpenAI key (also editable in Settings). */
function KeySetup() {
  const { uid } = useStore();
  const ui = useUI();
  const [v, setV] = useState("");
  return (
    <div className="rounded-xl border border-line bg-app/50 p-3.5">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
        <KeyRound className="h-4 w-4 text-gold" /> Add your OpenAI API key
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
        Create one at{" "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          platform.openai.com/api-keys
        </a>
        . It&apos;s saved to your account (so your phone and laptop both have it) and only ever sent to OpenAI.
      </p>
      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.trim().startsWith("sk-")) return ui.toast("OpenAI keys start with “sk-”");
          updateSettings(uid, { openaiKey: v.trim() })
            .then(() => ui.toast("Key saved"))
            .catch(() => ui.toast("Couldn't save — check your connection"));
        }}
      >
        <input type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} placeholder="sk-…" className={cn(inputCls, "min-w-0 flex-1")} aria-label="OpenAI API key" />
        <Button type="submit" variant="secondary" disabled={!v.trim()}>
          Save
        </Button>
      </form>
    </div>
  );
}

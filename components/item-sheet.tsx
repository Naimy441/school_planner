"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Repeat,
  BookOpen,
  FileText,
  ListChecks,
  Plus,
  CalendarClock,
  CalendarX2,
  Clock,
  ChevronRight,
  Gift,
  GraduationCap,
  Heart,
  Hourglass,
  Link2,
  MapPin,
  MoreHorizontal,
  Play,
  RotateCcw,
  Share,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteItem, instanceDate, patchItem, prepPoints, reopenItem, setPrep, stopSeries, stopTimer } from "@/lib/actions";
import { colorOf, courseLabel } from "@/lib/colors";
import { dayKey, daysUntil, dueLabel, fmtDuration, fmtEstimate, fmtTime, fromLocalInput, toLocalInput } from "@/lib/dates";
import { format } from "date-fns";
import { POINTS } from "@/lib/points";
import { isOverdue, prepValid, progressOf } from "@/lib/schedule";
import { accountabilityMessage, shareText } from "@/lib/share";
import { useStore } from "@/lib/store";
import type { Item } from "@/lib/types";
import { celebrate } from "./celebrate";
import { repeatSummary } from "./repeat-fields";
import { LinksEditor } from "./links-editor";
import { KIND_LABEL, useCompleteItem } from "./rows";
import { SubtaskList, SuggestionChips } from "./subtasks";
import { TextbookOpen } from "./textbook";
import { Bar, Button, Check, cn, IconButton, inputCls, PropRow, Sheet, useAutoHeight } from "./ui";
import { useUI } from "./ui-state";

const KIND_ICON = { assignment: FileText, exam: GraduationCap, textbook: BookOpen, task: ListChecks } as const;

export const EXAM_SUGGESTIONS = [
  "Review lecture notes",
  "Re-do practice problems",
  "Make a summary sheet",
  "Flashcards for key terms",
  "Timed past paper",
  "Go over mistakes",
];

const TASK_SUGGESTIONS = ["Read the instructions", "Outline / plan", "First draft", "Check & submit"];

export function ItemSheetHost() {
  const { itemId, openItem, front } = useUI();
  const { itemMap } = useStore();
  const item = itemId ? itemMap.get(itemId) : undefined;
  // keep the last item rendered while the sheet animates out
  const [last, setLast] = useState<Item | undefined>(item);
  if (item && item !== last) setLast(item);
  const shown = item || last;
  return (
    <Sheet open={!!item} onClose={() => openItem(null)} label="Task" front={front === "item"}>
      {shown && <ItemPage key={shown.id} item={shown} />}
    </Sheet>
  );
}

function AutoTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);
  useAutoHeight(ref, text);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setText(e.target.value.replace(/\n/g, ""))}
      onBlur={() => {
        editing.current = false;
        const t = text.trim();
        if (t && t !== value) onSave(t);
        else setText(value);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
      className="ghost-input resize-none overflow-hidden text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink sm:text-[30px]"
      placeholder="Untitled"
    />
  );
}

function LazyInput({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [v, setV] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setV(value);
  }, [value]);
  return (
    <input
      value={v}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        editing.current = false;
        if (v.trim() !== value) onSave(v.trim());
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder={placeholder}
      className={cn(
        "ghost-input h-[30px] rounded-md px-2 text-[14px] text-ink transition-colors hover:bg-hover focus:bg-hover",
        className,
      )}
    />
  );
}

/** Friendly date text that opens the native date-time picker. */
function DateField({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const label = Number.isNaN(value) ? "Pick a time" : `${format(value, "EEE, MMM d")} · ${fmtTime(value)}`;
  return (
    <div className="relative inline-flex">
      <span className="flex h-[30px] items-center rounded-md px-2 text-[14px] text-ink hover:bg-hover">{label}</span>
      <input
        ref={ref}
        type="datetime-local"
        aria-label="Date and time"
        value={Number.isNaN(value) ? "" : toLocalInput(value)}
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {}
        }}
        onChange={(e) => {
          const t = fromLocalInput(e.target.value);
          if (!Number.isNaN(t)) onChange(t);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}

function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const editing = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing.current) setV(value);
  }, [value]);
  useAutoHeight(ref, v, 72);
  return (
    <textarea
      ref={ref}
      value={v}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        editing.current = false;
        if (v !== value) onSave(v);
      }}
      placeholder="Notes, links, anything… "
      className="ghost-input resize-none text-[15px] leading-relaxed text-ink"
    />
  );
}

const ESTIMATES = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360];

/** How long you think it'll take — a quick pick, or any number of minutes. */
function EstimateField({ value, onChange }: { value: number | null | undefined; onChange: (min: number | null) => void }) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const options = value && !ESTIMATES.includes(value) ? [...ESTIMATES, value].sort((a, b) => a - b) : ESTIMATES;
  if (custom)
    return (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.round(Number(text));
          if (n > 0 && n <= 6000) onChange(n);
          setCustom(false);
        }}
      >
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={1}
          max={6000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          placeholder="Minutes"
          className={cn(inputCls, "h-[30px] w-24")}
        />
        <span className="text-[13px] text-ink-3">minutes</span>
      </form>
    );
  return (
    <select
      aria-label="Time estimate"
      value={value || ""}
      onChange={(e) => {
        if (e.target.value === "custom") {
          setText(value ? String(value) : "");
          setCustom(true);
        } else onChange(e.target.value ? Number(e.target.value) : null);
      }}
      className={cn("ghost-input h-[30px] cursor-pointer appearance-none rounded-md px-2 text-[14px] hover:bg-hover", !value && "text-ink-3")}
    >
      <option value="">No estimate</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {fmtEstimate(m)}
        </option>
      ))}
      <option value="custom">Custom…</option>
    </select>
  );
}

/** Send a friend a note asking them to check in on you about this. */
export function useShareWithFriend() {
  const { toast } = useUI();
  return async (item: Item) => {
    const r = await shareText(accountabilityMessage(item));
    if (r === "copied") toast("Message copied — paste it to a friend");
    else if (r === "failed") toast("Couldn't open sharing on this device");
  };
}

function ItemPage({ item }: { item: Item }) {
  const { uid, courseMap, courses, now, timer, series } = useStore();
  const ui = useUI();
  const router = useRouter();
  const complete = useCompleteItem();
  const [menu, setMenu] = useState(false);
  const course = item.courseId ? courseMap.get(item.courseId) : undefined;
  const color = colorOf(course?.color);
  const KindIcon = KIND_ICON[item.kind];
  const [showLate, setShowLate] = useState(!!item.lateDue);
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [showLinks, setShowLinks] = useState(!!item.links?.length);
  const share = useShareWithFriend();
  const [askDelete, setAskDelete] = useState(false);
  const itemSeries = item.seriesId ? series.find((x) => x.id === item.seriesId) : undefined;
  const repeating = !!itemSeries?.active;
  const { total, done, ratio } = progressOf(item);
  const overdue = isOverdue(item, now) && item.status === "open";
  const isExam = item.kind === "exam";
  const days = daysUntil(item.due, now);
  const examSoon = isExam && days >= 0 && days <= 7;
  const prepped = prepValid(item, now);
  const prep = prepped ? item.prep! : null;
  const timerHere = timer?.active && timer.itemId === item.id;
  const isOpen = item.status === "open";

  const save = (patch: Partial<Item>) => patchItem(uid, item.id, patch).catch(() => ui.toast("Couldn't save"));

  const missing: string[] = [];
  if (!item.place) missing.push("where you'll work");
  if (!total) missing.push("at least one step");
  if (!prep?.place) missing.push("arrive at your spot");
  if (!prep?.distractions) missing.push("clear distractions");
  const canStart = missing.length === 0;

  return (
    <div className="relative">
      <DeleteChoice item={item} open={askDelete} onClose={() => setAskDelete(false)} />
      {/* top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-panel/95 px-4 py-2 backdrop-blur-md sm:px-6">
        <div className="truncate text-[13px] text-ink-3">{KIND_LABEL[item.kind]}</div>
        <div className="relative flex items-center gap-1">
          {isOpen && (
            <IconButton label="Ask a friend to keep you accountable" onClick={() => share(item)}>
              <Share className="h-[17px] w-[17px]" />
            </IconButton>
          )}
          <IconButton label="More" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="Close" onClick={() => ui.openItem(null)}>
            <X className="h-[18px] w-[18px]" />
          </IconButton>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-9 z-20 w-52 origin-top-right rounded-lg border border-line bg-card-2 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
              >
                {!isOpen && (
                  <MenuBtn icon={<RotateCcw />} onClick={() => (reopenItem(uid, item), setMenu(false))}>
                    Reopen
                  </MenuBtn>
                )}
                {isOpen && (
                  <MenuBtn
                    icon={<Archive />}
                    onClick={async () => {
                      setMenu(false);
                      const ok = await ui.confirm({
                        title: `Archive “${item.title}”?`,
                        body: "It leaves your lists. Nothing is lost, but it won't come back on its own.",
                        confirmLabel: "Archive",
                      });
                      if (!ok) return;
                      patchItem(uid, item.id, { status: "archived" });
                      ui.openItem(null);
                      ui.toast("Let go — no guilt. It's archived.");
                    }}
                  >
                    Let it go (archive)
                  </MenuBtn>
                )}
                <MenuBtn
                  icon={<Trash2 />}
                  danger
                  onClick={async () => {
                    setMenu(false);
                    if (repeating) return setAskDelete(true);
                    const ok = await ui.confirm({ title: `Delete “${item.title}”?`, body: "Its steps and notes go with it. This can't be undone." });
                    if (!ok) return;
                    if (timerHere && timer) await stopTimer(uid, timer);
                    await deleteItem(uid, item);
                    ui.openItem(null);
                  }}
                >
                  Delete
                </MenuBtn>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-5 pb-10 sm:px-10" onClick={() => menu && setMenu(false)}>
        {/* icon + title */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="mb-3 mt-3 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: color.bg }}
        >
          <KindIcon className="h-6 w-6" style={{ color: color.fg }} />
        </motion.div>
        <AutoTitle value={item.title} onSave={(title) => save({ title })} />

        {item.status === "done" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2 text-[13.5px] text-good">
            <Sparkles className="h-4 w-4" /> Completed {item.completedAt ? dueLabel(item.completedAt, now).toLowerCase() : ""}
          </div>
        )}

        {/* encouraging banners */}
        {overdue && (
          <Banner tone="warm" icon={<Heart className="h-4 w-4" />}>
            This one slipped past its deadline — that happens to everyone.{" "}
            {item.lateDue && item.lateDue > now
              ? `It still counts until ${dueLabel(item.lateDue, now)}. `
              : "It's still worth finishing. "}
            Want to break it into a few small, easy steps and start with the first?
          </Banner>
        )}
        {examSoon && isOpen && (
          <Banner tone="blue" icon={<GraduationCap className="h-4 w-4" />}>
            <b className="font-semibold">
              {days <= 0 ? `Exam today at ${fmtTime(item.due)}.` : days === 1 ? `Exam tomorrow at ${fmtTime(item.due)}.` : `Exam in ${days} days at ${fmtTime(item.due)}.`}
            </b>{" "}
            {total < 2
              ? "How do you want to study for it? Add a step per topic, per day, or per technique — whatever works for you."
              : "You've got a plan. One step at a time."}
          </Banner>
        )}

        {/* properties */}
        <div className="mt-5 border-b border-line pb-3">
        <div>
          <PropRow icon={<BookOpen />} label="Class">
            <div className="flex min-w-0 items-center gap-1">
              <select
                value={item.courseId || ""}
                onChange={(e) => save({ courseId: e.target.value || null })}
                className="ghost-input h-[30px] min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-md px-2 text-[14px] hover:bg-hover"
              >
                <option value="">No class</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {courseLabel(c)}
                  </option>
                ))}
              </select>
              {course && (
                <button
                  onClick={() => ui.openCourse(course.id)}
                  className="flex h-[30px] shrink-0 items-center gap-0.5 rounded-md pl-2 pr-1 text-[13px] text-ink-3 hover:bg-hover hover:text-ink"
                >
                  Open class
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </PropRow>
          <PropRow icon={<CalendarClock />} label={isExam ? "Exam time" : "Due"}>
            <DateField value={item.due} onChange={(due) => save({ due })} />
          </PropRow>
          {item.kind === "assignment" && (
            <PropRow icon={<Repeat />} label="Repeats">
              <button
                onClick={() => ui.openRepeat(item.id)}
                className={cn("h-[30px] max-w-full truncate rounded-md px-2 text-left text-[14px] hover:bg-hover", repeating ? "text-ink" : "text-ink-3")}
              >
                {repeating ? repeatSummary(itemSeries!) : item.seriesId ? "No longer repeats" : "Doesn't repeat"}
              </button>
            </PropRow>
          )}
          {item.kind === "assignment" && (showLate || item.lateDue) && (
            <PropRow icon={<CalendarX2 />} label="Late deadline">
              {item.lateDue ? (
                <div className="flex items-center">
                  <DateField value={item.lateDue} onChange={(lateDue) => save({ lateDue })} />
                  <IconButton
                    label="Remove late deadline"
                    onClick={() => {
                      setShowLate(false);
                      save({ lateDue: null });
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              ) : (
                <button
                  onClick={() => save({ lateDue: item.due + 3 * 86_400_000 })}
                  className="h-[30px] rounded-md px-2 text-[14px] text-ink-3 hover:bg-hover"
                >
                  Set (3 days after due)
                </button>
              )}
            </PropRow>
          )}
          {isExam && (
            <PropRow icon={<MapPin />} label="Exam room">
              <LazyInput value={item.where || ""} onSave={(where) => save({ where })} placeholder="Empty" />
            </PropRow>
          )}
          <PropRow icon={<MapPin />} label="Work spot">
            <LazyInput value={item.place || ""} onSave={(place) => save({ place })} placeholder="Library 3rd floor, desk…" />
          </PropRow>
          <PropRow icon={<Gift />} label="Reward">
            <LazyInput value={item.reward || ""} onSave={(reward) => save({ reward })} placeholder="An episode, a coffee, a walk…" />
          </PropRow>
          <PropRow icon={<Hourglass />} label="Time estimate">
            <EstimateField value={item.estimateMin} onChange={(estimateMin) => save({ estimateMin })} />
          </PropRow>
          {!!item.focusMs && (
            <PropRow icon={<Clock />} label="Focused">
              <div className="px-2 pt-[5px] text-[14px] text-ink-2">
                {fmtDuration(item.focusMs)}
                {item.estimateMin ? <span className="text-ink-3"> of {fmtEstimate(item.estimateMin)}</span> : null}
              </div>
            </PropRow>
          )}
          {item.kind === "textbook" && course?.textbook && course.textbook.kind !== "none" && (
            <PropRow icon={<BookOpen />} label="Textbook">
              <TextbookOpen course={course} />
            </PropRow>
          )}
        </div>

        {isOpen && ((item.kind === "assignment" && !showLate && !item.lateDue) || (!showNotes && !item.notes) || (!showLinks && !item.links?.length)) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.kind === "assignment" && !showLate && !item.lateDue && (
              <button onClick={() => setShowLate(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink-2">
                <Plus className="h-3.5 w-3.5" /> Late deadline
              </button>
            )}
            {!showNotes && !item.notes && (
              <button onClick={() => setShowNotes(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink-2">
                <Plus className="h-3.5 w-3.5" /> Notes
              </button>
            )}
            {!showLinks && !item.links?.length && (
              <button onClick={() => setShowLinks(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink-2">
                <Plus className="h-3.5 w-3.5" /> Links
              </button>
            )}
          </div>
        )}

        </div>

        {(showLinks || !!item.links?.length) && (
          <div className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Link2 className="h-4 w-4 text-ink-3" /> Links
            </h3>
            <LinksEditor links={item.links || []} onChange={(links) => save({ links })} />
          </div>
        )}

        {(showNotes || item.notes) && (
          <div className="mt-5">
            <h3 className="mb-1 text-[15px] font-semibold text-ink">Notes</h3>
            <Notes value={item.notes || ""} onSave={(notes) => save({ notes })} />
          </div>
        )}

        {/* steps */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink">{isExam ? "Study plan" : "Steps"}</h3>
            {total > 0 && (
              <span className="tnum text-[12.5px] text-ink-3">
                {done} of {total}
              </span>
            )}
          </div>
          {total > 0 && <Bar value={ratio} height={5} color={ratio >= 1 ? "var(--good)" : "var(--accent)"} className="mb-3" />}
          <SubtaskList item={item} placeholder={isExam ? "Add a study step — a topic, a day, a technique…" : "Add a step"} />
          {isOpen && total === 0 && (
            <SuggestionChips item={item} suggestions={isExam ? EXAM_SUGGESTIONS : item.kind === "textbook" ? [] : TASK_SUGGESTIONS} />
          )}
        </div>

        {/* get ready */}
        {isOpen && (
          <div className="mt-7 rounded-xl border border-line bg-app/60 p-4">
            {timerHere ? (
              <div className="flex flex-col gap-3">
                <div className="text-[14px] text-ink-2">You&apos;re focusing on this right now.</div>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Play className="h-4 w-4" />}
                  onClick={() => {
                    ui.openItem(null);
                    router.push("/focus");
                  }}
                >
                  Back to focus
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink">Get ready</h3>
                  <span className="text-[12px] text-ink-3">+{POINTS.arrive} each</span>
                </div>
                <ReadyRow
                  step={1}
                  checked={!!prep?.place}
                  disabled={!item.place}
                  points={prepPoints(item, "place", now)}
                  onChange={(v, e) => {
                    const pts = prepPoints(item, "place", now);
                    if (v && pts) celebrate({ points: pts, x: e.clientX, y: e.clientY });
                    setPrep(uid, item, { place: v });
                  }}
                  title={item.place ? `I'm at ${item.place}` : "Where will you work?"}
                  sub={item.place ? "Going there is step zero — and it counts." : "Somewhere you can actually focus."}
                >
                  {!item.place && (
                    <LazyInput
                      value=""
                      onSave={(place) => place && save({ place })}
                      placeholder="Library 3rd floor, quiet café…"
                      className="mt-1.5 -ml-2 bg-hover"
                    />
                  )}
                </ReadyRow>
                <ReadyRow
                  step={2}
                  checked={!!prep?.distractions}
                  disabled={!prep?.place}
                  points={prepPoints(item, "distractions", now)}
                  onChange={(v, e) => {
                    const pts = prepPoints(item, "distractions", now);
                    if (v && pts) celebrate({ points: pts, x: e.clientX, y: e.clientY });
                    setPrep(uid, item, { distractions: v });
                  }}
                  title="Distractions are away"
                  sub={prep?.place ? "Phone face-down or in a bag, extra tabs closed." : "Unlocks once you're at your spot."}
                />
                <div className="flex items-start gap-3 rounded-lg px-1 py-2">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center pt-0.5 text-gold">
                    <Gift className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] text-ink">{item.reward ? "Your reward when it's done" : "Pick a reward for after"}</div>
                    <LazyInput
                      value={item.reward || ""}
                      onSave={(reward) => save({ reward })}
                      placeholder="An episode, a coffee, a walk…"
                      className="mt-0.5 -ml-2 text-[13.5px]"
                    />
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!canStart}
                  className="mt-3 w-full"
                  icon={<Play className="h-4 w-4" />}
                  onClick={() => ui.requestStart(item.id)}
                >
                  Start focus
                </Button>
                {!canStart && (
                  <p className="mt-2 text-center text-[12.5px] text-ink-3">Before you start: {missing.join(", ")}.</p>
                )}
              </>
            )}
          </div>
        )}

        {isOpen && (
          <div className="mt-3 flex justify-center">
            {total > 0 && done === total ? (
              <Button
                variant="good"
                size="lg"
                className="w-full"
                onClick={(e) => {
                  complete(item, e);
                  ui.openItem(null);
                }}
              >
                Every step&apos;s done — complete it 🎉
              </Button>
            ) : (
              <button
                onClick={(e) => {
                  complete(item, e);
                  ui.openItem(null);
                }}
                className="rounded-md px-3 py-2 text-[13px] text-ink-3 hover:bg-hover hover:text-ink-2"
              >
                Already done? Mark complete
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function DeleteChoice({ item, open, onClose }: { item: Item; open: boolean; onClose: () => void }) {
  const { uid, series, items, timer } = useStore();
  const ui = useUI();
  const s = item.seriesId ? series.find((x) => x.id === item.seriesId) : undefined;
  const from = instanceDate(item) || dayKey(item.due);
  const done = (msg: string) => {
    onClose();
    ui.openItem(null);
    ui.toast(msg);
  };
  const stopTimerIfHere = () => timer?.active && timer.itemId === item.id && stopTimer(uid, timer);
  return (
    <Sheet open={open} onClose={onClose} mode="center" label="Delete weekly assignment">
      <div className="p-6">
        <h3 className="text-[17px] font-semibold text-ink">Delete “{item.title}”?</h3>
        <p className="mt-1 text-[13.5px] text-ink-3">This one repeats every week.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={async () => {
              stopTimerIfHere();
              await deleteItem(uid, item);
              done("Deleted this week's — the rest are untouched");
            }}
          >
            Just this one
          </Button>
          {s && (
            <Button
              variant="danger"
              size="lg"
              className="border border-[rgba(224,92,89,0.35)]"
              onClick={async () => {
                stopTimerIfHere();
                await stopSeries(uid, s, from, items, true);
                done("Deleted this and all upcoming weeks");
              }}
            >
              This and all upcoming
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function ReadyRow({
  step,
  checked,
  onChange,
  title,
  sub,
  disabled,
  points,
  children,
}: {
  step: number;
  checked: boolean;
  onChange: (v: boolean, e: React.MouseEvent) => void;
  title: string;
  sub: string;
  disabled?: boolean;
  points: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-1 py-2">
      <div className={cn("pt-0.5 transition-opacity", disabled && "pointer-events-none opacity-30")}>
        <Check checked={checked} onChange={disabled ? undefined : onChange} label={`Step ${step}: ${title}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className={cn("text-[14.5px] transition-colors", checked ? "text-ink-2" : disabled && !children ? "text-ink-3" : "text-ink")}>
            {title}
          </div>
          {!checked && points > 0 && <span className={cn("shrink-0 text-[12px]", disabled ? "text-ink-3/60" : "text-gold/80")}>+{points}</span>}
        </div>
        <div className={cn("text-[12.5px]", disabled && !children ? "text-ink-3/70" : "text-ink-3")}>{sub}</div>
        {children}
      </div>
    </div>
  );
}

export function Banner({ tone, icon, children }: { tone: "warm" | "blue" | "good"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mt-4 flex gap-3 rounded-lg px-3.5 py-3 text-[13.5px] leading-relaxed",
        tone === "warm" && "bg-warn-soft text-[#f0c9a8]",
        tone === "blue" && "bg-accent-soft text-[#b5d3f3]",
        tone === "good" && "bg-good-soft text-[#bfe3cf]",
      )}
    >
      <span className="mt-[3px] shrink-0">{icon}</span>
      <div>{children}</div>
    </motion.div>
  );
}

function MenuBtn({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] hover:bg-hover [&>svg]:h-4 [&>svg]:w-4",
        danger ? "text-danger" : "text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

"use client";

import { motion } from "motion/react";
import { GraduationCap } from "lucide-react";
import { completeItem, completionPoints } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { dueLabel, fmtTime } from "@/lib/dates";
import { effectiveDeadline, isOverdue, progressOf } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ClassSession, Item, ItemKind } from "@/lib/types";
import { celebrate } from "./celebrate";
import { Check, cn } from "./ui";
import { useUI } from "./ui-state";

export const KIND_LABEL: Record<ItemKind, string> = {
  assignment: "Assignment",
  exam: "Exam",
  textbook: "Reading",
  task: "Task",
};

export const rowMotion = {
  layout: true,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 24, height: 0, transition: { duration: 0.28 } },
  transition: { type: "spring", stiffness: 380, damping: 34 },
} as const;

export function useCompleteItem() {
  const { uid, timer, profile } = useStore();
  const { toast } = useUI();
  return (item: Item, e?: { clientX: number; clientY: number }) => {
    const pts = item.rewarded ? 0 : completionPoints(item).total;
    completeItem(uid, item, timer).catch(() => toast("Couldn't save — check your connection"));
    celebrate({
      points: pts,
      big: true,
      title: item.title,
      subtitle: item.kind === "exam" ? "Study plan complete" : "Done",
      reward: item.reward,
      totalPoints: profile.points + pts,
      x: e?.clientX,
      y: e?.clientY,
    });
  };
}

/**
 * One line of "when". `timeOnly` is for lists already grouped by day, so the
 * day isn't repeated on every row.
 */
export function whenText(item: Item, now: number, timeOnly = false) {
  if (item.kind !== "exam" && isOverdue(item, now)) {
    const late = item.lateDue && effectiveDeadline(item, now) === item.lateDue;
    return late ? `Late window until ${dueLabel(item.lateDue!, now)}` : "Past due — whenever you're ready";
  }
  if (timeOnly) return item.kind === "exam" ? `Exam at ${fmtTime(item.due)}` : `Due ${fmtTime(item.due)}`;
  return item.kind === "exam" ? `Exam ${dueLabel(item.due, now)}` : dueLabel(item.due, now);
}

export function Meta({ parts, warm }: { parts: (string | undefined | null | false)[]; warm?: boolean }) {
  const list = parts.filter(Boolean) as string[];
  return (
    <div className={cn("mt-0.5 truncate text-[12.5px]", warm ? "text-warn/85" : "text-ink-3")}>{list.join(" · ")}</div>
  );
}

const lead = "flex h-[22px] w-[22px] shrink-0 items-center justify-center";

export function ItemRow({ item, timeOnly = false, showCourse = true }: { item: Item; timeOnly?: boolean; showCourse?: boolean }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const complete = useCompleteItem();
  const course = item.courseId ? courseMap.get(item.courseId) : undefined;
  const { total, done } = progressOf(item);
  const isExam = item.kind === "exam";
  const color = colorOf(course?.color);

  return (
    <motion.div {...rowMotion} className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => ui.openItem(item.id)}
        onKeyDown={(e) => e.key === "Enter" && ui.openItem(item.id)}
        className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-hover active:bg-press"
      >
        {isExam ? (
          <span className={cn(lead, "rounded-md")} style={{ background: color.bg }}>
            <GraduationCap className="h-3.5 w-3.5" style={{ color: color.fg }} />
          </span>
        ) : (
          <Check checked={item.status === "done"} onChange={(_, e) => complete(item, e)} label={`Complete ${item.title}`} />
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-[14.5px]", item.status === "done" ? "text-ink-3 line-through" : "text-ink")}>{item.title}</div>
          <Meta parts={[showCourse && (course?.code || course?.name), whenText(item, now, timeOnly)]} warm={item.status === "open" && isOverdue(item, now)} />
        </div>
        {total > 0 && (
          <span className="tnum shrink-0 rounded-md bg-hover px-1.5 py-0.5 text-[11.5px] text-ink-3">
            {done}/{total}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function ClassRow({ s, onCheckIn }: { s: ClassSession; onCheckIn?: () => void }) {
  const { courseMap, now } = useStore();
  const c = courseMap.get(s.courseId);
  if (!c) return null;
  const color = colorOf(c.color);
  const live = now >= s.start - 10 * 60_000 && now < s.end;
  const mins = Math.round((s.start - now) / 60_000);
  return (
    <motion.div {...rowMotion} className="overflow-hidden">
      <div className="flex items-center gap-3 rounded-lg px-2.5 py-2.5">
        <span className={lead}>
          <span className="h-[18px] w-[3px] rounded-full" style={{ background: color.dot }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] text-ink">{c.name}</div>
          <Meta parts={[`${fmtTime(s.start)} – ${fmtTime(s.end)}`, s.location]} />
        </div>
        {live && onCheckIn ? (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onCheckIn}
            className="shrink-0 rounded-md bg-good px-2.5 py-1 text-[12px] font-semibold text-white"
          >
            I&apos;m here
          </motion.button>
        ) : mins > 0 && mins < 120 ? (
          <span className="tnum shrink-0 text-[12px] text-ink-3">in {mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}</span>
        ) : null}
      </div>
    </motion.div>
  );
}

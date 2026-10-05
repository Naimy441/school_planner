"use client";

import { motion } from "motion/react";
import { BookOpen, ChevronRight, ClipboardList, FileText, ListChecks, MapPin, Repeat } from "lucide-react";
import { completeItem, completionPoints } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { dueLabel, fmtTime } from "@/lib/dates";
import { effectiveDeadline, isOverdue, progressOf } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ClassSession, Item, ItemKind } from "@/lib/types";
import { celebrate } from "./celebrate";
import { Bar, Check, cn, Tag } from "./ui";
import { useUI } from "./ui-state";

export const KIND_META: Record<ItemKind, { label: string; icon: typeof FileText }> = {
  assignment: { label: "Assignment", icon: FileText },
  exam: { label: "Exam", icon: ClipboardList },
  textbook: { label: "Reading", icon: BookOpen },
  task: { label: "Task", icon: ListChecks },
};

export const rowMotion = {
  layout: true,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 24, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.28 } },
  transition: { type: "spring", stiffness: 380, damping: 34 },
} as const;

export function useCompleteItem() {
  const { uid, timer, profile } = useStore();
  const { toast } = useUI();
  return async (item: Item, e?: { clientX: number; clientY: number }) => {
    const pts = item.rewarded ? 0 : completionPoints(item).total;
    const saving = completeItem(uid, item, timer);
    {
      celebrate({
        points: pts,
        big: true,
        title: item.title,
        subtitle: item.kind === "exam" ? "Study plan complete" : "Task complete",
        reward: item.reward,
        totalPoints: profile.points + pts,
        x: e?.clientX,
        y: e?.clientY,
      });
    }
    saving.catch(() => toast("Couldn't save — check your connection"));
  };
}

export function DueText({ item, now }: { item: Item; now: number }) {
  if (item.kind === "exam") {
    return <span className="text-ink-3">{dueLabel(item.due, now)}</span>;
  }
  if (isOverdue(item, now)) {
    const late = item.lateDue && effectiveDeadline(item, now) === item.lateDue;
    return (
      <span className="text-warn/90">
        {late ? `Late window · until ${dueLabel(item.lateDue!, now)}` : "Whenever you're ready"}
      </span>
    );
  }
  const soon = item.due - now < 24 * 3_600_000;
  return <span className={soon ? "text-ink-2" : "text-ink-3"}>{dueLabel(item.due, now)}</span>;
}

export function ItemRow({ item, showCourse = true, priority = false }: { item: Item; showCourse?: boolean; priority?: boolean }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const complete = useCompleteItem();
  const course = item.courseId ? courseMap.get(item.courseId) : undefined;
  const { total, done, ratio } = progressOf(item);
  const Icon = KIND_META[item.kind].icon;
  const isExam = item.kind === "exam";

  return (
    <motion.div {...rowMotion} className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => ui.openItem(item.id)}
        onKeyDown={(e) => e.key === "Enter" && ui.openItem(item.id)}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-hover active:bg-press",
          priority && "bg-hover",
        )}
      >
        {isExam ? (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md" style={{ background: colorOf(course?.color).bg }}>
            <Icon className="h-3.5 w-3.5" style={{ color: colorOf(course?.color).fg }} />
          </span>
        ) : (
          <Check checked={item.status === "done"} onChange={(_, e) => complete(item, e)} label={`Complete ${item.title}`} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {!isExam && <Icon className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
            <span className="truncate text-[14.5px] text-ink">{item.title}</span>
            {item.seriesId && <Repeat className="h-3 w-3 shrink-0 text-ink-3" />}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12.5px]">
            {showCourse && course && <Tag color={course.color}>{course.code || course.name}</Tag>}
            <DueText item={item} now={now} />
          </div>
        </div>
        {total > 0 && (
          <div className="hidden w-16 shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="tnum text-[11px] text-ink-3">
              {done}/{total}
            </span>
            <Bar value={ratio} height={4} color={ratio >= 1 ? "var(--good)" : "var(--accent)"} />
          </div>
        )}
        {total > 0 && (
          <span className="tnum shrink-0 text-[11px] text-ink-3 sm:hidden">
            {done}/{total}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.div>
  );
}

export function ClassRow({ s, onCheckIn }: { s: ClassSession; onCheckIn?: () => void }) {
  const { courseMap, now } = useStore();
  const ui = useUI();
  const c = courseMap.get(s.courseId);
  if (!c) return null;
  const color = colorOf(c.color);
  const live = now >= s.start - 10 * 60_000 && now < s.end;
  const mins = Math.round((s.start - now) / 60_000);
  return (
    <motion.div {...rowMotion} className="overflow-hidden">
      <div
        onClick={() => ui.openCourse(c.id)}
        className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-hover"
      >
        <div className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: color.dot }} />
        <div className="w-[58px] shrink-0">
          <div className="tnum text-[13px] font-medium text-ink">{fmtTime(s.start)}</div>
          <div className="tnum text-[11.5px] text-ink-3">{fmtTime(s.end)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] text-ink">{c.name}</div>
          {s.location && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-3">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{s.location}</span>
            </div>
          )}
        </div>
        {live && onCheckIn ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCheckIn();
            }}
            className="shrink-0 rounded-md bg-good px-2.5 py-1 text-[12px] font-semibold text-white"
          >
            I&apos;m here
          </button>
        ) : mins > 0 && mins < 120 ? (
          <span className="shrink-0 text-[12px] text-ink-3">in {mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}</span>
        ) : null}
      </div>
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { BookOpen, ChevronRight, GraduationCap, Plus } from "lucide-react";
import { Button, Card, Empty, Page } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { colorOf } from "@/lib/colors";
import { meetingSummary } from "@/lib/schedule";
import { useStore } from "@/lib/store";

export default function ClassesPage() {
  const { courses, attendance, ready } = useStore();
  const ui = useUI();

  return (
    <Page>
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[32px]">Classes</h1>
      <p className="mt-1 text-[14.5px] text-ink-2">Set these up once. Tap a class to add its textbook.</p>

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => ui.setImportOpen(true)}>
          Import .ics
        </Button>
        <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => ui.setNewCourse(true)}>
          Add by hand
        </Button>
      </div>

      {ready && !courses.length ? (
        <div className="mt-6">
          <Empty icon={<GraduationCap />} title="No classes yet" body="Import your timetable as an .ics file, or add classes one by one." />
        </div>
      ) : (
        <Card className="mt-6 p-1">
          {courses.map((c, idx) => {
            const att = [...attendance.values()].filter((a) => a.courseId === c.id);
            const a = att.filter((x) => x.status === "attended").length;
            const m = att.filter((x) => x.status === "missed").length;
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => ui.openCourse(c.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-hover"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c.color).dot }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] text-ink">{c.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                    {[c.meetings[0] && meetingSummary(c.meetings[0]), c.meetings.length > 1 && `+${c.meetings.length - 1}`, a + m > 0 && `${Math.round((a / (a + m)) * 100)}% attended`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {c.textbook.kind !== "none" && <BookOpen className="h-4 w-4 shrink-0 text-ink-3" aria-label="Has textbook" />}
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
              </motion.button>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

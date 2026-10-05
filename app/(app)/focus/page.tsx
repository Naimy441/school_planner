"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Play, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { FocusView } from "@/components/focus-view";
import { Meta, whenText } from "@/components/rows";
import { Button, Card, Empty, Page, SectionTitle } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { dayKey, fmtDuration } from "@/lib/dates";
import { isOverdue, nextSubtasks, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";

export default function FocusPage() {
  const { timer, itemMap, items, now, courseMap, days, settings } = useStore();
  const ui = useUI();
  const [more, setMore] = useState(false);
  const item = timer?.active && timer.itemId ? itemMap.get(timer.itemId) : undefined;
  const queue = useMemo(() => workQueue(items, now), [items, now]);

  if (timer?.active && item) return <FocusView timer={timer} item={item} />;

  const todayFocus = days.get(dayKey(now))?.focusMs || 0;
  const [top, ...rest] = queue;
  const topCourse = top?.courseId ? courseMap.get(top.courseId) : undefined;

  return (
    <Page>
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[32px]">Focus</h1>
      <p className="mt-1 text-[14.5px] text-ink-2">
        {todayFocus ? `${fmtDuration(todayFocus)} today. ` : ""}One thing, one spot, one timer.
      </p>

      {top ? (
        <>
          <Card className="mt-7 p-5">
            <div className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Suggested</div>
            <button className="mt-1 block w-full text-left" onClick={() => ui.openItem(top.id)}>
              <div className="text-[19px] font-semibold text-ink">{top.title}</div>
              <Meta parts={[topCourse?.code || topCourse?.name, whenText(top, now)]} warm={isOverdue(top, now)} />
              {nextSubtasks(top).current && <div className="mt-2 text-[14px] text-ink-2">Next: {nextSubtasks(top).current!.title}</div>}
            </button>
            <Button variant="primary" size="lg" className="mt-5 w-full" icon={<Play className="h-4 w-4" />} onClick={() => ui.requestStart(top.id)}>
              Start · {settings.workMin}/{settings.breakMin}
            </Button>
          </Card>

          {rest.length > 0 && (
            <section className="mt-6">
              <button onClick={() => setMore((v) => !v)} className="flex items-center gap-1.5 px-1 text-[13px] text-ink-3 hover:text-ink-2">
                <motion.span animate={{ rotate: more ? 0 : -90 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
                Pick something else · {rest.length}
              </button>
              <AnimatePresence>
                {more && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <SectionTitle className="sr-only">Other tasks</SectionTitle>
                    <Card className="mt-2 p-1">
                      {rest.map((i) => {
                        const c = i.courseId ? courseMap.get(i.courseId) : undefined;
                        return (
                          <div key={i.id} className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-hover">
                            <button className="min-w-0 flex-1 text-left" onClick={() => ui.openItem(i.id)}>
                              <div className="truncate text-[14.5px] text-ink">{i.title}</div>
                              <Meta parts={[c?.code || c?.name, whenText(i, now)]} warm={isOverdue(i, now)} />
                            </button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => ui.requestStart(i.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hover text-ink-2 hover:text-ink"
                              aria-label={`Start ${i.title}`}
                            >
                              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                            </motion.button>
                          </div>
                        );
                      })}
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </>
      ) : (
        <div className="mt-8">
          <Empty icon={<Timer />} title="Nothing to focus on yet" body="Add an assignment, exam or task with the + button." />
        </div>
      )}
    </Page>
  );
}

"use client";

import { motion } from "motion/react";
import { Play, Timer } from "lucide-react";
import { useMemo } from "react";
import { FocusView } from "@/components/focus-view";
import { DueText } from "@/components/rows";
import { Card, Empty, Page, SectionTitle, Tag } from "@/components/ui";
import { useUI } from "@/components/ui-state";
import { dayKey, fmtDuration } from "@/lib/dates";
import { prepValid, progressOf, workQueue } from "@/lib/schedule";
import { useStore } from "@/lib/store";

export default function FocusPage() {
  const { timer, itemMap, items, now, courseMap, days, settings } = useStore();
  const ui = useUI();
  const item = timer?.active && timer.itemId ? itemMap.get(timer.itemId) : undefined;
  const queue = useMemo(() => workQueue(items, now), [items, now]);

  if (timer?.active && item) return <FocusView timer={timer} item={item} />;

  const todayFocus = days.get(dayKey(now))?.focusMs || 0;

  return (
    <Page>
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink sm:text-[34px]">Focus</h1>
      <p className="mt-1 text-[14.5px] text-ink-2">
        {todayFocus ? `${fmtDuration(todayFocus)} focused today. ` : ""}Pick one thing. Get to your spot. Start the clock.
      </p>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Default rhythm {settings.workMin}/{settings.breakMin} — you can change it when you start.
      </p>

      <section className="mt-8">
        <SectionTitle>Ready when you are</SectionTitle>
        {queue.length ? (
          <div className="flex flex-col gap-2">
            {queue.slice(0, 12).map((i, idx) => {
              const c = i.courseId ? courseMap.get(i.courseId) : undefined;
              const { done, total } = progressOf(i);
              const ready = prepValid(i, now) && i.prep?.place && i.prep?.distractions;
              return (
                <motion.div key={i.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <Card className="flex items-center gap-3 p-3" onClick={() => ui.openItem(i.id)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[12px]">
                        {idx === 0 && <span className="rounded bg-accent-soft px-1.5 py-[1px] text-[11px] font-semibold text-accent">Top priority</span>}
                        {c && <Tag color={c.color}>{c.code || c.name}</Tag>}
                        <DueText item={i} now={now} />
                      </div>
                      <div className="mt-1 truncate text-[15px] font-medium text-ink">{i.title}</div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        {total ? `${done}/${total} steps` : "No steps yet"}
                        {i.place ? ` · ${i.place}` : ""}
                        {ready ? " · ready" : ""}
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        ui.requestStart(i.id);
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                      aria-label={`Start ${i.title}`}
                    >
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </motion.button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Empty icon={<Timer />} title="Nothing to focus on yet" body="Add an assignment, exam or task, then come back here to start a session." />
        )}
      </section>
    </Page>
  );
}

"use client";

import { Repeat } from "lucide-react";
import { useState } from "react";
import { makeRepeating, stopSeries, updateSeries } from "@/lib/actions";
import { dayKey, MIN } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Item, Series } from "@/lib/types";
import { termEnd } from "./new-item";
import { lateOffsetOf } from "@/lib/schedule";
import { RepeatFields, repeatError, type RepeatValue } from "./repeat-fields";
import { Button, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function RepeatEditorHost() {
  const ui = useUI();
  const { itemMap, series } = useStore();
  const item = ui.repeatFor ? itemMap.get(ui.repeatFor) : undefined;
  const s = item?.seriesId ? series.find((x) => x.id === item.seriesId) : undefined;
  return (
    <Sheet open={!!item} onClose={() => ui.openRepeat(null)} mode="center" label="Repeat">
      {item && <RepeatEditor key={item.id} item={item} series={s?.active ? s : undefined} />}
    </Sheet>
  );
}

function hhmm(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RepeatEditor({ item, series }: { item: Item; series?: Series }) {
  const ui = useUI();
  const { uid, items, courseMap } = useStore();
  const today = dayKey();
  const [value, setValue] = useState<RepeatValue>(() =>
    series
      ? { days: series.days, time: series.time, start: series.startDate, end: series.endDate, lateOffsetMin: lateOffsetOf(series) }
      : {
          days: [new Date(item.due).getDay()],
          time: hhmm(item.due),
          start: dayKey(item.due),
          end: termEnd(courseMap.get(item.courseId || ""), today),
          lateOffsetMin: item.lateDue && item.lateDue > item.due ? Math.round((item.lateDue - item.due) / MIN) : null,
        },
  );
  const [busy, setBusy] = useState(false);
  const valid = !repeatError(value);
  const close = () => ui.openRepeat(null);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      ui.toast(msg);
      close();
    } catch {
      ui.toast("Couldn't save — try again");
    } finally {
      setBusy(false);
    }
  };

  const next = (): Omit<Series, "id"> => ({
    courseId: item.courseId || "",
    title: item.title,
    days: value.days,
    time: value.time,
    startDate: value.start,
    endDate: value.end,
    lateOffsetMin: value.lateOffsetMin,
    lateDays: null,
    createdAt: series?.createdAt || Date.now(),
    active: true,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Repeat className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-[17px] font-semibold text-ink">{series ? "Repeats weekly" : "Make it weekly"}</h3>
          <p className="text-[12.5px] text-ink-3">{item.title}</p>
        </div>
      </div>

      {!item.courseId ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[13.5px] text-[#f0c9a8]">Pick a class for this assignment first — weekly ones belong to a class.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <RepeatFields value={value} onChange={setValue} />
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            {series
              ? "Changes apply to upcoming weeks. Weeks you've already started keep their steps and notes."
              : "This one stays as this week's copy; the next ones appear automatically."}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {series ? (
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => run(() => stopSeries(uid, series, today, items), "Stopped repeating — this one stays")}
          >
            Stop repeating
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || !valid || !item.courseId}
            onClick={() =>
              run(
                () => (series ? updateSeries(uid, series, next(), items) : makeRepeating(uid, item, next())),
                series ? "Updated upcoming weeks" : "Now repeats weekly",
              )
            }
          >
            {series ? "Save" : "Make weekly"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Repeat } from "lucide-react";
import { useState } from "react";
import { makeRepeating, patchItem, stopSeries, updateSeries } from "@/lib/actions";
import { dayKey } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Item, Series } from "@/lib/types";
import { termEnd } from "./new-item";
import { nextOfSeries, ScheduleFields, scheduleError, toSeriesRule, type Schedule } from "./repeat-fields";
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

function RepeatEditor({ item, series }: { item: Item; series?: Series }) {
  const ui = useUI();
  const { uid, items, courseMap } = useStore();
  const today = dayKey();
  const [value, setValue] = useState<Schedule>(() => {
    if (series) {
      const next = nextOfSeries(series);
      return { due: next?.due ?? item.due, late: next?.lateDue ?? null, repeat: true, until: series.endDate };
    }
    return { due: item.due, late: item.lateDue ?? null, repeat: true, until: termEnd(courseMap.get(item.courseId || ""), today) };
  });
  const [busy, setBusy] = useState(false);
  const valid = !scheduleError(value);
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

  const rule = (): Omit<Series, "id"> => ({
    courseId: item.courseId || "",
    title: item.title,
    ...toSeriesRule(value),
    createdAt: series?.createdAt || Date.now(),
    active: true,
  });

  const makeWeekly = async () => {
    // this assignment becomes the first week, so it moves to the chosen date too
    if (value.due !== item.due || (value.late ?? null) !== (item.lateDue ?? null)) {
      await patchItem(uid, item.id, { due: value.due, lateDue: value.late });
    }
    await makeRepeating(uid, { ...item, due: value.due }, rule());
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Repeat className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-[17px] font-semibold text-ink">{series ? "Weekly" : "Make it weekly"}</h3>
          <p className="text-[12.5px] text-ink-3">{item.title}</p>
        </div>
      </div>

      {!item.courseId ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[13.5px] text-[#f0c9a8]">Pick a class for this assignment first — weekly ones belong to a class.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ScheduleFields value={value} onChange={setValue} dueLabel={series ? "Next due" : "Due"} allowRepeat allowLate fixedRepeat />
          {series && <p className="text-[12.5px] text-ink-3">Changes apply from the next one on. Weeks you&apos;ve started are kept.</p>}
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
              run(() => (series ? updateSeries(uid, series, rule(), items) : makeWeekly()), series ? "Updated upcoming weeks" : "Now repeats weekly")
            }
          >
            {series ? "Save" : "Make weekly"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { archiveItem } from "@/lib/actions";
import { colorOf } from "@/lib/colors";
import { agoLabel } from "@/lib/dates";
import { needsWrapUp, unmarkedPast } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { useCompleteItem } from "./rows";
import { Button, Sheet } from "./ui";
import { useUI } from "./ui-state";

/**
 * When an assignment's late window closes, ask instead of silently hiding it:
 * maybe it was turned in and just never checked off.
 */
export function WrapUpPrompt() {
  const { items, ready, now, uid, courseMap, sessions, attendance } = useStore();
  const ui = useUI();
  const complete = useCompleteItem();
  const [later, setLater] = useState(false);
  const pending = useMemo(() => items.filter((i) => needsWrapUp(i, now)).sort((a, b) => a.due - b.due), [items, now]);
  // Don't stack on top of the class check-in.
  const classAsk = unmarkedPast(sessions, attendance, courseMap, now).length > 0;
  const item = pending[0];
  const c = item?.courseId ? courseMap.get(item.courseId) : undefined;
  const open = ready && !later && !classAsk && !!item;

  return (
    <Sheet open={open} onClose={() => setLater(true)} mode="center" label="Did you turn it in?">
      {item && (
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-6">
            <div className="flex items-center justify-between text-[12px] text-ink-3">
              <span className="font-medium uppercase tracking-[0.12em]">Quick check-in</span>
              {pending.length > 1 && <span>{pending.length} to go</span>}
            </div>
            <h3 className="mt-3 text-[20px] font-semibold leading-snug text-ink">
              Did you turn in <span style={{ color: colorOf(c?.color).fg }}>{item.title}</span>?
            </h3>
            <p className="mt-1.5 text-[14px] text-ink-2">
              {c ? `${c.code || c.name} · ` : ""}Its late window closed {agoLabel(item.lateDue!, now)}.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="good" size="lg" onClick={(e) => complete(item, e)}>
                Yes, I did
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  archiveItem(uid, item).catch(() => ui.toast("Couldn't save"));
                  ui.toast("Let go — no guilt. On to the next one.");
                }}
              >
                No, let it go
              </Button>
            </div>
            <p className="mt-4 text-center text-[12.5px] text-ink-3">Either way it leaves your list.</p>
          </motion.div>
        </AnimatePresence>
      )}
    </Sheet>
  );
}

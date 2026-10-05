"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { fmtTime } from "./dates";
import { effectiveDeadline } from "./schedule";
import type { Item } from "./types";

/** "tonight at 11:59 PM", "tomorrow at 9 AM", "Friday at 5 PM", "Oct 21 at 9 AM" */
function byWhen(t: number, now: number) {
  if (!Number.isFinite(t) || t <= now) return "today";
  const diff = differenceInCalendarDays(new Date(t), new Date(now));
  const time = fmtTime(t);
  if (diff === 0) return `${new Date(t).getHours() >= 18 ? "tonight" : "today"} at ${time}`;
  if (diff === 1) return `tomorrow at ${time}`;
  if (diff < 7) return `${format(t, "EEEE")} at ${time}`;
  return `${format(t, "MMM d")} at ${time}`;
}

/** The note sent to a friend asking them to hold you to it. */
export function accountabilityMessage(item: Item, now = Date.now()) {
  const goal = item.kind === "exam" ? `be ready for “${item.title}”` : `complete “${item.title}”`;
  const when = byWhen(item.kind === "exam" ? item.due : effectiveDeadline(item, now), now);
  return `I want to ${goal} by ${when}, but I need you to keep me accountable. Please text me later today to see if I actually got this done and encourage me to do it if I haven't.`;
}

/**
 * The system share sheet where there is one (iPhone, Mac Safari/Chrome), otherwise the clipboard.
 * Resolves to how it went so the caller can say so.
 */
export async function shareText(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

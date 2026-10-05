import { addDays, atTime, DAY, dayKey, fmtTime, HOUR, parseDay } from "./dates";
import type { Attendance, ClassSession, Course, Item, Meeting, Series } from "./types";

export function sessionId(courseId: string, date: string, startTime: string) {
  return `${courseId}_${date}_${startTime.replace(":", "")}`;
}

function daysBetween(a: string, b: string) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
}

export function meetingOccursOn(m: Meeting, date: string) {
  if (date < m.startDate || date > m.endDate) return false;
  const dow = parseDay(date).getDay();
  if (!m.days.includes(dow)) return false;
  if (m.exdates?.includes(date)) return false;
  const interval = Math.max(1, m.interval || 1);
  if (interval > 1) {
    const startDow = parseDay(m.startDate).getDay();
    const week = Math.floor((daysBetween(m.startDate, date) + startDow) / 7);
    if (week % interval !== 0) return false;
  }
  return true;
}

/** All class sessions with a date in [fromKey, toKey]. Sorted by start. */
export function sessionsBetween(courses: Course[], fromKey: string, toKey: string): ClassSession[] {
  const out: ClassSession[] = [];
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) {
    for (const c of courses) {
      for (const m of c.meetings || []) {
        if (!meetingOccursOn(m, d)) continue;
        out.push({
          id: sessionId(c.id, d, m.start),
          courseId: c.id,
          meetingId: m.id,
          date: d,
          startTime: m.start,
          start: atTime(d, m.start),
          end: atTime(d, m.end),
          location: m.location || c.location,
        });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Class that's about to start or in progress (shown full-screen). */
export const CLASS_LEAD = 10 * 60_000;

export function currentSession(sessions: ClassSession[], att: Map<string, Attendance>, now = Date.now()) {
  return sessions.find((s) => now >= s.start - CLASS_LEAD && now < s.end && !att.has(s.id)) || null;
}

/** Past sessions nobody checked in for (asked about on next open). */
export function unmarkedPast(
  sessions: ClassSession[],
  att: Map<string, Attendance>,
  courses: Map<string, Course>,
  now = Date.now(),
) {
  return sessions.filter((s) => {
    if (s.end > now || att.has(s.id)) return false;
    const c = courses.get(s.courseId);
    // don't ask about classes from before the course was added
    return !!c && s.end > c.createdAt;
  });
}

// ---------- items ----------

/** An assignment whose late window has closed and is still open — we ask about it. */
export function needsWrapUp(item: Item, now = Date.now()) {
  return item.status === "open" && item.kind !== "exam" && !!item.lateDue && now > item.lateDue;
}

/** Exams linger a few hours after they start, then fall off. */
const EXAM_GRACE = 3 * HOUR;

export function isVisible(item: Item, now = Date.now()) {
  if (item.status !== "open") return false;
  if (item.kind === "exam") return now < item.due + EXAM_GRACE;
  if (item.lateDue && now > item.lateDue) return false;
  return true;
}

export function isOverdue(item: Item, now = Date.now()) {
  return item.kind !== "exam" && now > item.due;
}

/** The deadline that actually matters right now (late deadline once the first one passes). */
export function effectiveDeadline(item: Item, now = Date.now()) {
  if (now < item.due) return item.due;
  if (item.lateDue && now < item.lateDue) return item.lateDue;
  return Number.POSITIVE_INFINITY;
}

export function byPriority(now = Date.now()) {
  return (a: Item, b: Item) => {
    const ea = effectiveDeadline(a, now);
    const eb = effectiveDeadline(b, now);
    if (ea !== eb) return ea - eb;
    return a.due - b.due;
  };
}

export function prioritized(items: Item[], now = Date.now()) {
  return items.filter((i) => isVisible(i, now) && i.kind !== "exam").sort(byPriority(now));
}

/** Includes exam prep, sorted by what's due first. */
export function workQueue(items: Item[], now = Date.now()) {
  return items.filter((i) => isVisible(i, now) && (i.kind !== "exam" || i.due > now)).sort(byPriority(now));
}

export function progressOf(item: Item) {
  const total = item.subtasks.length;
  const done = item.subtasks.filter((s) => s.done).length;
  return { total, done, ratio: total ? done / total : 0 };
}

export function nextSubtasks(item: Item) {
  const open = item.subtasks.filter((s) => !s.done);
  return { current: open[0] || null, upcoming: open[1] || null, remaining: open.length };
}

export const PREP_TTL = 6 * HOUR;

export function prepValid(item: Item, now = Date.now()) {
  return !!item.prep && now - item.prep.at < PREP_TTL;
}

// ---------- materialisation ----------

export function seriesOccurrences(s: Series, fromKey: string, toKey: string) {
  const out: { date: string; due: number; lateDue: number | null }[] = [];
  const from = fromKey > s.startDate ? fromKey : s.startDate;
  const to = toKey < s.endDate ? toKey : s.endDate;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!s.days.includes(parseDay(d).getDay())) continue;
    const due = atTime(d, s.time);
    out.push({ date: d, due, lateDue: s.lateDays ? due + s.lateDays * DAY : null });
  }
  return out;
}

export function textbookDates(course: Course, fromKey: string, toKey: string) {
  if (!course.textbook || course.textbook.kind === "none") return [];
  const since = course.textbook.since || dayKey(course.createdAt);
  const from = fromKey > since ? fromKey : since;
  const dates = new Set<string>();
  for (const s of sessionsBetween([course], from, toKey)) dates.add(s.date);
  return [...dates];
}

export function textbookItemId(courseId: string, date: string) {
  return `tb_${courseId}_${date}`;
}

export function seriesItemId(seriesId: string, date: string) {
  return `${seriesId}_${date}`;
}

export function meetingSummary(m: Meeting) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [...m.days].sort().map((d) => names[d]).join(", ");
  return `${days} · ${fmtTime(m.start)} – ${fmtTime(m.end)}`;
}

/** Consecutive days with points, counting today only once it has some. */
export function streakOf(days: Map<string, { points?: number }>, today: string) {
  let n = 0;
  let d = (days.get(today)?.points || 0) > 0 ? today : addDays(today, -1);
  while ((days.get(d)?.points || 0) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

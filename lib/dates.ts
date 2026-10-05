import { differenceInCalendarDays, format } from "date-fns";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar key, YYYY-MM-DD. */
export function dayKey(d: Date | number = new Date()) {
  const x = typeof d === "number" ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ms for a day key at local HH:mm */
export function atTime(key: string, hhmm: string) {
  const d = parseDay(key);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function addDays(key: string, n: number) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function startOfDayMs(t: number = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(t: number = Date.now()) {
  const d = new Date(t);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

/** "9:30" → "9:30 AM" style, compact. */
export function fmtTime(t: number | string) {
  if (typeof t === "string") {
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    t = d.getTime();
  }
  const d = new Date(t);
  return format(d, d.getMinutes() === 0 ? "h a" : "h:mm a");
}

export function dayLabel(key: string, now = Date.now()) {
  const diff = differenceInCalendarDays(parseDay(key), new Date(now));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(parseDay(key), "EEEE");
  return format(parseDay(key), "EEE, MMM d");
}

/** Short, friendly due label. */
export function dueLabel(due: number, now = Date.now()) {
  const diff = differenceInCalendarDays(new Date(due), new Date(now));
  const time = fmtTime(due);
  if (due < now) {
    const days = Math.max(1, Math.round((now - due) / DAY));
    if (now - due < DAY && diff === 0) return `Earlier today`;
    return days === 1 ? "Since yesterday" : `${days} days ago`;
  }
  if (diff === 0) return `Today · ${time}`;
  if (diff === 1) return `Tomorrow · ${time}`;
  if (diff < 7) return `${format(new Date(due), "EEE")} · ${time}`;
  return format(new Date(due), "MMM d · ") + time;
}

/** "earlier today" / "yesterday" / "3 days ago" */
export function agoLabel(t: number, now = Date.now()) {
  const d = differenceInCalendarDays(new Date(now), new Date(t));
  if (d <= 0) return "earlier today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export function daysUntil(t: number, now = Date.now()) {
  return differenceInCalendarDays(new Date(t), new Date(now));
}

export function fmtDuration(ms: number) {
  const totalMin = Math.round(ms / MIN);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** a time estimate in minutes → "~45m", "~1h 30m" */
export function fmtEstimate(min: number) {
  return `~${fmtDuration(min * MIN)}`;
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** value for <input type="datetime-local"> */
export function toLocalInput(t: number) {
  const d = new Date(t);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string) {
  if (!v) return NaN;
  const [date, time] = v.split("T");
  return atTime(date, time || "00:00");
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

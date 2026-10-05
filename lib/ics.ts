import { addDays, dayKey, parseDay } from "./dates";
import type { Meeting } from "./types";

/** Minimal RFC 5545 reader, tuned for university timetable exports. */

interface RawEvent {
  uid?: string;
  summary?: string;
  location?: string;
  dtstart?: Date;
  dtend?: Date;
  allDay?: boolean;
  rrule?: Record<string, string>;
  exdates: string[];
  recurrenceId?: Date;
}

export interface CourseDraft {
  key: string;
  name: string;
  code?: string;
  location?: string;
  meetings: Meeting[];
  exams: { title: string; due: number; where?: string }[];
}

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unescape(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function parseDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))), allDay: false };
  // TZID / floating times are treated as wall-clock time in the user's zone.
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function parseIcs(text: string): RawEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { exdates: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...rawParams] = head.split(";");
    const params: Record<string, string> = {};
    for (const p of rawParams) {
      const [k, v] = p.split("=");
      if (k) params[k.toUpperCase()] = (v || "").replace(/"/g, "");
    }
    switch (name.toUpperCase()) {
      case "UID":
        cur.uid = value.trim();
        break;
      case "SUMMARY":
        cur.summary = unescape(value);
        break;
      case "LOCATION":
        cur.location = unescape(value);
        break;
      case "DTSTART": {
        const r = parseDate(value, params);
        if (r) {
          cur.dtstart = r.date;
          cur.allDay = r.allDay;
        }
        break;
      }
      case "DTEND": {
        const r = parseDate(value, params);
        if (r) cur.dtend = r.date;
        break;
      }
      case "RRULE": {
        const rule: Record<string, string> = {};
        for (const part of value.split(";")) {
          const [k, v] = part.split("=");
          if (k) rule[k.toUpperCase()] = v || "";
        }
        cur.rrule = rule;
        break;
      }
      case "EXDATE":
        for (const v of value.split(",")) {
          const r = parseDate(v, params);
          if (r) cur.exdates.push(dayKey(r.date));
        }
        break;
      case "RECURRENCE-ID": {
        const r = parseDate(value, params);
        if (r) cur.recurrenceId = r.date;
        break;
      }
    }
  }
  return events;
}

const CODE_RE = /\b([A-Z]{2,5})\s?-?\s?(\d{2,4}[A-Z]?)\b/;
const EXAM_RE = /\b(exam|midterm|mid-term|final|quiz|test)\b/i;

function groupKey(summary: string) {
  const m = summary.match(CODE_RE);
  if (m) return { key: `${m[1]} ${m[2]}`, code: `${m[1]} ${m[2]}` };
  // Strip trailing component words like "Lecture", "Lab", "Tutorial"
  const base = summary.replace(/\s*[-–:|]\s*(lecture|lab|tutorial|seminar|recitation|discussion|lec|tut|sem).*$/i, "").trim();
  return { key: base.toLowerCase(), code: undefined };
}

const COMPONENT_RE = /\s*[-–:|]\s*(lecture|lab|laboratory|tutorial|seminar|recitation|discussion|workshop|studio|lec|tut|sem|lab section)\b.*$/i;

function splitComponent(summary: string) {
  const m = summary.match(COMPONENT_RE);
  if (!m) return { base: summary.trim(), part: undefined as string | undefined };
  const word = m[1];
  return { base: summary.slice(0, m.index).trim(), part: word[0].toUpperCase() + word.slice(1).toLowerCase() };
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Turn raw events into per-course drafts with weekly meeting patterns. */
export function draftsFromIcs(text: string, horizonDays = 200): CourseDraft[] {
  const events = parseIcs(text).filter((e) => e.dtstart && e.summary && !e.allDay);
  const groups = new Map<string, CourseDraft>();
  const locCount = new Map<string, Map<string, number>>();

  // Overrides (RECURRENCE-ID) knock the original occurrence out of its series.
  const overridden = new Map<string, string[]>();
  for (const e of events) {
    if (e.recurrenceId && e.uid) {
      const list = overridden.get(e.uid) || [];
      list.push(dayKey(e.recurrenceId));
      overridden.set(e.uid, list);
    }
  }

  for (const e of events) {
    const start = e.dtstart!;
    const end = e.dtend && e.dtend > start ? e.dtend : new Date(start.getTime() + 50 * 60_000);
    if (end.getTime() - start.getTime() > 6 * 3_600_000) continue;

    const { key, code } = groupKey(e.summary!);
    const { base: baseName, part } = splitComponent(e.summary!);
    let g = groups.get(key);
    if (!g) {
      g = { key, name: baseName, code, meetings: [], exams: [] };
      groups.set(key, g);
    }
    // Prefer the shortest non-exam name ("CS 101" over "CS 101 Midterm").
    const isExam = EXAM_RE.test(e.summary!);
    if (!isExam && (EXAM_RE.test(g.name) || baseName.length < g.name.length)) g.name = baseName;

    if (!e.rrule && EXAM_RE.test(e.summary!)) {
      g.exams.push({ title: e.summary!, due: start.getTime(), where: e.location });
      continue;
    }

    if (e.location) {
      const lc = locCount.get(key) || new Map();
      lc.set(e.location, (lc.get(e.location) || 0) + 1);
      locCount.set(key, lc);
    }

    const startDate = dayKey(start);
    const exdates = [...e.exdates, ...(e.uid && !e.recurrenceId ? overridden.get(e.uid) || [] : [])];
    const base: Meeting = {
      id: rid(),
      days: [start.getDay()],
      start: hhmm(start),
      end: hhmm(end),
      location: e.location,
      startDate,
      endDate: startDate,
      exdates: exdates.length ? exdates : undefined,
      label: part,
    };

    const r = e.rrule;
    if (r && (r.FREQ === "WEEKLY" || r.FREQ === "DAILY")) {
      const days = r.BYDAY
        ? r.BYDAY.split(",")
            .map((d) => DAY_CODES[d.replace(/^[-+\d]+/, "").toUpperCase()])
            .filter((d) => d !== undefined)
        : r.FREQ === "DAILY"
          ? [0, 1, 2, 3, 4, 5, 6]
          : [start.getDay()];
      base.days = [...new Set(days)];
      base.interval = r.FREQ === "WEEKLY" && r.INTERVAL ? Math.max(1, +r.INTERVAL) : 1;
      if (r.UNTIL) {
        const u = parseDate(r.UNTIL, {});
        base.endDate = u ? dayKey(u.date) : addDays(startDate, horizonDays);
      } else if (r.COUNT) {
        // Walk forward until COUNT occurrences are used up.
        let left = +r.COUNT;
        let d = startDate;
        let guard = 0;
        while (left > 0 && guard++ < 2000) {
          const dow = parseDay(d).getDay();
          if (base.days.includes(dow)) left--;
          if (left > 0) d = addDays(d, 1);
        }
        base.endDate = d;
      } else {
        base.endDate = addDays(startDate, horizonDays);
      }
    }
    g.meetings.push(base);
  }

  for (const [key, g] of groups) {
    const lc = locCount.get(key);
    if (lc) g.location = [...lc.entries()].sort((a, b) => b[1] - a[1])[0][0];
    g.meetings = mergeMeetings(g.meetings);
  }

  return [...groups.values()]
    .filter((g) => g.meetings.length || g.exams.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Collapse identical one-off sessions into weekly patterns where possible. */
function mergeMeetings(ms: Meeting[]): Meeting[] {
  const recurring = ms.filter((m) => m.startDate !== m.endDate);
  const oneOff = ms.filter((m) => m.startDate === m.endDate);
  const buckets = new Map<string, Meeting[]>();
  for (const m of oneOff) {
    const k = `${m.days[0]}|${m.start}|${m.end}|${m.location || ""}`;
    buckets.set(k, [...(buckets.get(k) || []), m]);
  }
  const merged: Meeting[] = [...recurring];
  for (const list of buckets.values()) {
    if (list.length < 3) {
      merged.push(...list);
      continue;
    }
    const dates = list.map((m) => m.startDate).sort();
    const all = new Set(dates);
    const ex: string[] = [];
    for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 7)) if (!all.has(d)) ex.push(d);
    merged.push({ ...list[0], startDate: dates[0], endDate: dates[dates.length - 1], interval: 1, exdates: ex.length ? ex : undefined });
  }
  // Combine patterns that only differ by weekday (MWF lecture) into one row.
  const byShape = new Map<string, Meeting>();
  for (const m of merged) {
    const k = `${m.start}|${m.end}|${m.location || ""}|${m.startDate.slice(0, 7)}|${m.endDate}|${m.interval || 1}|${m.label || ""}`;
    const prev = byShape.get(k);
    if (prev && m.startDate !== m.endDate) {
      prev.days = [...new Set([...prev.days, ...m.days])].sort();
      prev.exdates = [...new Set([...(prev.exdates || []), ...(m.exdates || [])])];
      if (m.startDate < prev.startDate) prev.startDate = m.startDate;
    } else {
      byShape.set(k + (m.startDate === m.endDate ? m.startDate : ""), { ...m });
    }
  }
  return [...byShape.values()];
}

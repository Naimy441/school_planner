"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
  type Transaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { addDays, dayKey, MIN } from "./dates";
import { seriesOccurrences } from "./schedule";
import { POINTS } from "./points";
import type {
  AttendanceStatus,
  ClassSession,
  Course,
  Item,
  Series,
  Settings,
  Subtask,
  TimerState,
} from "./types";

export const uidRef = (uid: string) => doc(db(), "users", uid);
const col = (uid: string, name: string) => collection(db(), "users", uid, name);
export const itemRef = (uid: string, id: string) => doc(db(), "users", uid, "items", id);
const courseRef = (uid: string, id: string) => doc(db(), "users", uid, "courses", id);
const seriesRef = (uid: string, id: string) => doc(db(), "users", uid, "series", id);
export const timerRef = (uid: string) => doc(db(), "users", uid, "state", "timer");
const dayRef = (uid: string, key: string) => doc(db(), "users", uid, "days", key);

export const newId = () => doc(col("x", "y")).id;
export const shortId = () => Math.random().toString(36).slice(2, 10);

type Writer = WriteBatch | Transaction;

interface Award {
  points?: number;
  subtasks?: number;
  items?: number;
  classes?: number;
  focusMs?: number;
  missed?: number;
}

/** Bump running totals on the profile and today's stats doc in one write group. */
function award(w: Writer, uid: string, a: Award, when = Date.now()) {
  const p: Record<string, unknown> = {};
  const d: Record<string, unknown> = { date: dayKey(when) };
  if (a.points) {
    p.points = increment(a.points);
    d.points = increment(a.points);
  }
  if (a.subtasks) {
    p.subtasksDone = increment(a.subtasks);
    d.subtasks = increment(a.subtasks);
  }
  if (a.items) {
    p.itemsDone = increment(a.items);
    d.items = increment(a.items);
  }
  if (a.classes) {
    p.classesAttended = increment(a.classes);
    d.classes = increment(a.classes);
  }
  if (a.missed) p.classesMissed = increment(a.missed);
  if (a.focusMs) {
    p.focusMs = increment(a.focusMs);
    d.focusMs = increment(a.focusMs);
  }
  // set+merge works for both batches and transactions and creates docs lazily
  (w as WriteBatch).set(uidRef(uid), p, { merge: true });
  (w as WriteBatch).set(dayRef(uid, dayKey(when)), d, { merge: true });
}

export async function ensureProfile(uid: string, displayName?: string | null) {
  const snap = await getDoc(uidRef(uid)).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(uidRef(uid), {
      displayName: displayName || "",
      points: 0,
      focusMs: 0,
      subtasksDone: 0,
      itemsDone: 0,
      classesAttended: 0,
      classesMissed: 0,
      createdAt: Date.now(),
      settings: { workMin: 25, breakMin: 5, sound: true, dailyGoal: 150 },
    });
  }
}

export function updateSettings(uid: string, s: Partial<Settings>) {
  return setDoc(uidRef(uid), { settings: s }, { merge: true });
}

// ---------- courses ----------

export async function saveCourse(uid: string, c: Omit<Course, "id"> & { id?: string }) {
  const id = c.id || newId();
  const { id: _omit, ...rest } = c;
  void _omit;
  await setDoc(courseRef(uid, id), rest);
  return id;
}

export function patchCourse(uid: string, id: string, patch: Partial<Course>) {
  return updateDoc(courseRef(uid, id), patch as Record<string, unknown>);
}

export async function deleteCourse(uid: string, course: Course, items: Item[], series: Series[]) {
  const b = writeBatch(db());
  b.delete(courseRef(uid, course.id));
  for (const s of series.filter((s) => s.courseId === course.id)) b.delete(seriesRef(uid, s.id));
  for (const i of items.filter((i) => i.courseId === course.id && i.status === "open")) b.delete(itemRef(uid, i.id));
  await b.commit();
}

// ---------- items ----------

/** Returns the new id immediately; the write syncs in the background. */
export function createItem(uid: string, data: Partial<Item> & Pick<Item, "kind" | "title" | "due">) {
  const id = data.id || newId();
  const item: Omit<Item, "id"> = {
    courseId: null,
    subtasks: [],
    status: "open",
    createdAt: Date.now(),
    ...data,
  };
  delete (item as Partial<Item>).id;
  setDoc(itemRef(uid, id), item).catch((e) => console.error("createItem", e));
  return id;
}

/** Create only if it doesn't exist yet (safe across devices racing). */
export async function createIfMissing(uid: string, id: string, data: Omit<Item, "id">) {
  const ref = itemRef(uid, id);
  await runTransaction(db(), async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) t.set(ref, data);
  });
}

export function patchItem(uid: string, id: string, patch: Partial<Item>) {
  return updateDoc(itemRef(uid, id), patch as Record<string, unknown>);
}

export function setSubtasks(uid: string, item: Item, subtasks: Subtask[]) {
  return updateDoc(itemRef(uid, item.id), { subtasks });
}

export async function addSubtask(uid: string, item: Item, title: string, at?: number) {
  const s: Subtask = { id: shortId(), title, done: false };
  const list = [...item.subtasks];
  list.splice(at ?? list.length, 0, s);
  await setSubtasks(uid, item, list);
  return s;
}

export async function toggleSubtask(uid: string, item: Item, subId: string, done?: boolean) {
  const cur = item.subtasks.find((s) => s.id === subId);
  if (!cur) return;
  const next = done ?? !cur.done;
  if (next === cur.done) return;
  const b = writeBatch(db());
  b.update(itemRef(uid, item.id), {
    subtasks: item.subtasks.map((s) => (s.id === subId ? { ...s, done: next, doneAt: next ? Date.now() : null } : s)),
  });
  award(b, uid, next ? { points: POINTS.subtask, subtasks: 1 } : { points: -POINTS.subtask, subtasks: -1 });
  await b.commit();
}

const PREP_WINDOW = 6 * 60 * MIN;

/** Points a readiness check would earn right now (0 if already earned this session). */
export function prepPoints(item: Item, step: "place" | "distractions", now = Date.now()) {
  const at = step === "place" ? item.arriveAwardedAt : item.calmAwardedAt;
  return at && now - at < PREP_WINDOW ? 0 : step === "place" ? POINTS.arrive : POINTS.distractions;
}

export async function setPrep(uid: string, item: Item, patch: { place?: boolean; distractions?: boolean }) {
  const now = Date.now();
  const fresh = item.prep && now - item.prep.at < PREP_WINDOW;
  const prep = { at: now, place: false, distractions: false, ...(fresh ? item.prep : {}), ...patch };
  // The steps go in order: leaving your spot also resets "distractions away".
  if (patch.place === false) prep.distractions = false;
  const b = writeBatch(db());
  const upd: Record<string, unknown> = { prep };
  if (patch.place && prepPoints(item, "place", now)) {
    upd.arriveAwardedAt = now;
    award(b, uid, { points: POINTS.arrive, subtasks: 1 });
  }
  if (patch.distractions && prepPoints(item, "distractions", now)) {
    upd.calmAwardedAt = now;
    award(b, uid, { points: POINTS.distractions, subtasks: 1 });
  }
  b.update(itemRef(uid, item.id), upd);
  await b.commit();
}

export function completionPoints(item: Item, now = Date.now()) {
  const base = item.kind === "exam" ? POINTS.examStudy : POINTS.item;
  const onTime = item.kind !== "exam" && now <= item.due ? POINTS.onTime : 0;
  return { base, onTime, total: base + onTime };
}

export async function completeItem(uid: string, item: Item, timer: TimerState | null) {
  const now = Date.now();
  const b = writeBatch(db());
  b.update(itemRef(uid, item.id), { status: "done", completedAt: now, rewarded: true });
  const pts = item.rewarded ? 0 : completionPoints(item, now).total;
  award(b, uid, { points: pts, items: item.rewarded ? 0 : 1 });
  if (timer?.active && timer.itemId === item.id) finishTimerInto(b, uid, timer, now);
  await b.commit();
  return pts;
}

export function reopenItem(uid: string, item: Item) {
  return updateDoc(itemRef(uid, item.id), { status: "open", completedAt: null });
}

export function archiveItem(uid: string, item: Item) {
  return updateDoc(itemRef(uid, item.id), { status: "archived" });
}

export function deleteItem(uid: string, item: Item) {
  // Generated items are archived so they don't get re-created.
  if (item.seriesId || item.kind === "textbook") return archiveItem(uid, item);
  return deleteDoc(itemRef(uid, item.id));
}

// ---------- series ----------

export async function saveSeries(uid: string, s: Omit<Series, "id"> & { id?: string }) {
  const id = s.id || newId();
  const { id: _omit, ...rest } = s;
  void _omit;
  await setDoc(seriesRef(uid, id), rest);
  return id;
}

/** The class day a generated weekly item belongs to (ids look like `${seriesId}_${YYYY-MM-DD}`). */
export function instanceDate(i: Item) {
  return i.seriesId && i.id.startsWith(`${i.seriesId}_`) ? i.id.slice(i.seriesId.length + 1) : null;
}

/** Nothing the user would lose: no steps, prep, notes or focus time. */
function untouched(i: Item) {
  return !i.subtasks.length && !i.prep && !i.notes && !i.focusMs;
}

/**
 * Change a weekly rule. Upcoming weeks move to the new schedule; weeks that no
 * longer fit are removed unless you've already started them. Past weeks keep
 * their original deadlines.
 */
export async function updateSeries(uid: string, s: Series, next: Omit<Series, "id">, items: Item[]) {
  const b = writeBatch(db());
  b.set(seriesRef(uid, s.id), next);
  const now = Date.now();
  const nextS = { ...next, id: s.id };
  for (const i of items) {
    const d = instanceDate(i);
    if (i.seriesId !== s.id || i.status !== "open" || !d) continue;
    const occ = seriesOccurrences(nextS, d, d)[0];
    if (i.due <= now && (!occ || occ.due <= now)) continue;
    if (occ) b.update(itemRef(uid, i.id), { title: next.title, courseId: next.courseId, due: occ.due, lateDue: occ.lateDue });
    else if (untouched(i)) b.delete(itemRef(uid, i.id));
  }
  await b.commit();
}

/**
 * Stop repeating from `fromDate` on (inclusive). Weeks you've started stay
 * unless `removeStarted` (the explicit "delete this and upcoming").
 */
export async function stopSeries(uid: string, s: Series, fromDate: string, items: Item[], removeStarted = false) {
  const b = writeBatch(db());
  b.update(seriesRef(uid, s.id), { active: false, endDate: addDays(fromDate, -1) });
  for (const i of items) {
    const d = instanceDate(i);
    if (i.seriesId !== s.id || i.status !== "open" || !d || d < fromDate) continue;
    if (removeStarted || untouched(i)) b.delete(itemRef(uid, i.id));
  }
  await b.commit();
}

/** Turn a one-off assignment into a weekly one; it stays as this week's copy. */
export async function makeRepeating(uid: string, item: Item, next: Omit<Series, "id">) {
  const id = newId();
  // Later weeks are generated from the day after this one, so it isn't duplicated.
  const startDate = next.startDate > dayKey(item.due) ? next.startDate : addDays(dayKey(item.due), 1);
  const b = writeBatch(db());
  b.set(seriesRef(uid, id), { ...next, startDate });
  b.update(itemRef(uid, item.id), { seriesId: id });
  await b.commit();
  return id;
}

// ---------- attendance ----------

export async function markAttendance(uid: string, s: ClassSession, status: AttendanceStatus) {
  const b = writeBatch(db());
  b.set(doc(db(), "users", uid, "attendance", s.id), {
    courseId: s.courseId,
    date: s.date,
    start: s.startTime,
    status,
    at: Date.now(),
  });
  if (status === "attended") award(b, uid, { points: POINTS.classAttended, classes: 1 });
  else if (status === "missed") award(b, uid, { missed: 1 });
  await b.commit();
}

// ---------- timer ----------

export function phaseMs(t: Pick<TimerState, "phase" | "workMin" | "breakMin">, phase = t.phase) {
  return (phase === "work" ? t.workMin : t.breakMin) * MIN;
}

export function remainingOf(t: TimerState, now = Date.now()) {
  if (t.endsAt == null) return t.remainingMs ?? phaseMs(t);
  return t.endsAt - now;
}

export async function startTimer(uid: string, itemId: string, workMin: number, breakMin: number) {
  const now = Date.now();
  const t: TimerState = {
    active: true,
    itemId,
    phase: "work",
    workMin,
    breakMin,
    endsAt: now + workMin * MIN,
    remainingMs: null,
    cycle: 0,
    startedAt: now,
    updatedAt: now,
  };
  await setDoc(timerRef(uid), t);
  updateSettings(uid, { workMin, breakMin }).catch(() => {});
}

export function pauseTimer(uid: string, t: TimerState) {
  if (t.endsAt == null) return;
  return updateDoc(timerRef(uid), { endsAt: null, remainingMs: Math.max(0, t.endsAt - Date.now()), updatedAt: Date.now() });
}

export function resumeTimer(uid: string, t: TimerState) {
  const rem = t.remainingMs ?? phaseMs(t);
  return updateDoc(timerRef(uid), { endsAt: Date.now() + rem, remainingMs: null, updatedAt: Date.now() });
}

export function adjustTimer(uid: string, t: TimerState, workMin: number, breakMin: number) {
  const now = Date.now();
  const oldLen = phaseMs(t);
  const newLen = (t.phase === "work" ? workMin : breakMin) * MIN;
  const delta = newLen - oldLen;
  const patch: Record<string, unknown> = { workMin, breakMin, updatedAt: now };
  if (t.endsAt != null) patch.endsAt = Math.max(now + 1000, t.endsAt + delta);
  else patch.remainingMs = Math.max(1000, (t.remainingMs ?? oldLen) + delta);
  updateSettings(uid, { workMin, breakMin }).catch(() => {});
  return updateDoc(timerRef(uid), patch);
}

/** Credit the elapsed part of a work block. */
function creditWork(w: Writer, uid: string, t: TimerState, workedMs: number, now: number) {
  if (workedMs < MIN || !t.itemId) return;
  const ms = Math.min(workedMs, t.workMin * MIN);
  const mins = Math.floor(ms / MIN);
  award(w, uid, { points: mins * POINTS.focusMinute, focusMs: ms }, now);
  (w as WriteBatch).set(doc(col(uid, "sessions")), { itemId: t.itemId, workMs: ms, endedAt: now });
  (w as WriteBatch).update(itemRef(uid, t.itemId), { focusMs: increment(ms) });
}

function workedSoFar(t: TimerState, now: number) {
  if (t.phase !== "work") return 0;
  return phaseMs(t) - Math.max(0, remainingOf(t, now));
}

function finishTimerInto(w: Writer, uid: string, t: TimerState, now: number) {
  creditWork(w, uid, t, workedSoFar(t, now), now);
  (w as WriteBatch).set(timerRef(uid), { ...t, active: false, endsAt: null, remainingMs: null, updatedAt: now });
}

export async function stopTimer(uid: string, t: TimerState) {
  const b = writeBatch(db());
  finishTimerInto(b, uid, t, Date.now());
  await b.commit();
}

/**
 * Move to the next phase. Runs in a transaction keyed on the phase+endsAt we
 * observed, so several open devices hitting zero at once advance it only once.
 * If nobody was around when the phase ended, the next phase waits paused.
 */
export async function advanceTimer(uid: string, seen: TimerState, opts: { skip?: boolean } = {}) {
  const ref = timerRef(uid);
  const run = async (w: Writer, t: TimerState) => {
    const now = Date.now();
    const next = t.phase === "work" ? "break" : "work";
    if (t.phase === "work") {
      const worked = opts.skip ? workedSoFar(t, now) : phaseMs(t);
      creditWork(w, uid, t, worked, now);
    }
    const nextLen = phaseMs(t, next);
    const ended = t.endsAt ?? now;
    const fresh = !opts.skip && t.endsAt != null && now - ended < 90_000;
    (w as WriteBatch).set(ref, {
      ...t,
      phase: next,
      cycle: t.phase === "work" ? t.cycle + 1 : t.cycle,
      endsAt: opts.skip ? now + nextLen : fresh ? ended + nextLen : null,
      remainingMs: opts.skip || fresh ? null : nextLen,
      updatedAt: now,
    } satisfies TimerState);
  };
  try {
    await runTransaction(db(), async (tx) => {
      const snap = await tx.get(ref);
      const t = snap.data() as TimerState | undefined;
      if (!t?.active || t.phase !== seen.phase || t.endsAt !== seen.endsAt || t.remainingMs !== seen.remainingMs) return;
      await run(tx, t);
    });
  } catch {
    // offline: transactions need the server, fall back to a plain write
    const b = writeBatch(db());
    await run(b, seen);
    await b.commit();
  }
}

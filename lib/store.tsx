"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where, type QuerySnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createIfMissing, ensureProfile } from "./actions";
import { addDays, atTime, dayKey, DAY } from "./dates";
import { auth, db } from "./firebase";
import {
  seriesItemId,
  seriesOccurrences,
  sessionsBetween,
  textbookDates,
  textbookItemId,
} from "./schedule";
import type { Attendance, ClassSession, Course, DayStat, Item, Profile, Series, Settings, TimerState } from "./types";

export const DEFAULT_SETTINGS: Settings = { workMin: 25, breakMin: 5, sound: true, dailyGoal: 150 };

const EMPTY_PROFILE: Profile = {
  points: 0,
  focusMs: 0,
  subtasksDone: 0,
  itemsDone: 0,
  classesAttended: 0,
  classesMissed: 0,
};

interface Store {
  user: User | null;
  authReady: boolean;
  /** first snapshots from the server have arrived */
  ready: boolean;
  uid: string;
  now: number;
  profile: Profile;
  settings: Settings;
  courses: Course[];
  courseMap: Map<string, Course>;
  items: Item[];
  itemMap: Map<string, Item>;
  series: Series[];
  attendance: Map<string, Attendance>;
  days: Map<string, DayStat>;
  timer: TimerState | null;
  /** class sessions from a week ago to two weeks out */
  sessions: ClassSession[];
}

const Ctx = createContext<Store | null>(null);

function docsOf<T>(snap: QuerySnapshot) {
  return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [courses, setCourses] = useState<Course[]>([]);
  const [openItems, setOpenItems] = useState<Item[]>([]);
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [doneItems, setDoneItems] = useState<Item[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [attendanceList, setAttendance] = useState<Attendance[]>([]);
  const [dayList, setDays] = useState<DayStat[]>([]);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [serverSynced, setServerSynced] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) ensureProfile(u.uid, u.displayName).catch(() => {});
    });
  }, []);

  // A coarse clock for schedule-driven UI (the timer runs its own fast tick).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    const onVis = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const uid = user?.uid || "";

  useEffect(() => {
    if (!uid) return;
    const d = db();
    const base = ["users", uid] as const;
    const mark = (k: string) => (fromCache: boolean) =>
      !fromCache && setServerSynced((s) => (s[k] ? s : { ...s, [k]: true }));
    const since = Date.now() - 45 * DAY;
    const subs = [
      onSnapshot(doc(d, ...base), { includeMetadataChanges: true }, (s) => {
        setProfile({ ...EMPTY_PROFILE, ...(s.data() as Profile | undefined) });
      }),
      onSnapshot(collection(d, ...base, "courses"), { includeMetadataChanges: true }, (s) => {
        setCourses(docsOf<Course>(s).sort((a, b) => a.name.localeCompare(b.name)));
        mark("courses")(s.metadata.fromCache);
      }),
      onSnapshot(query(collection(d, ...base, "items"), where("status", "==", "open")), { includeMetadataChanges: true }, (s) => {
        setOpenItems(docsOf<Item>(s));
        mark("open")(s.metadata.fromCache);
      }),
      onSnapshot(query(collection(d, ...base, "items"), where("due", ">=", since)), { includeMetadataChanges: true }, (s) => {
        setRecentItems(docsOf<Item>(s));
        mark("recent")(s.metadata.fromCache);
      }),
      onSnapshot(query(collection(d, ...base, "items"), where("completedAt", ">=", since)), (s) => {
        setDoneItems(docsOf<Item>(s));
      }),
      onSnapshot(collection(d, ...base, "series"), { includeMetadataChanges: true }, (s) => {
        setSeries(docsOf<Series>(s));
        mark("series")(s.metadata.fromCache);
      }),
      onSnapshot(collection(d, ...base, "attendance"), (s) => setAttendance(docsOf<Attendance>(s))),
      onSnapshot(query(collection(d, ...base, "days"), where("date", ">=", dayKey(Date.now() - 180 * DAY))), (s) =>
        setDays(docsOf<DayStat & { id: string }>(s).map((x) => ({ ...x, date: x.date || x.id }))),
      ),
      onSnapshot(doc(d, ...base, "state", "timer"), (s) => setTimer((s.data() as TimerState) || null)),
    ];
    return () => {
      subs.forEach((u) => u());
      setServerSynced({});
      setOpenItems([]);
      setRecentItems([]);
      setDoneItems([]);
      setCourses([]);
      setSeries([]);
      setAttendance([]);
      setDays([]);
      setTimer(null);
      setProfile(EMPTY_PROFILE);
    };
  }, [uid]);

  const items = useMemo(() => {
    const m = new Map<string, Item>();
    for (const list of [recentItems, doneItems, openItems]) for (const i of list) m.set(i.id, i);
    return [...m.values()];
  }, [openItems, recentItems, doneItems]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const attendance = useMemo(() => new Map(attendanceList.map((a) => [a.id, a])), [attendanceList]);
  const days = useMemo(() => new Map(dayList.map((d) => [d.date, d])), [dayList]);
  const today = dayKey(now);
  const sessions = useMemo(
    () => sessionsBetween(courses, addDays(today, -7), addDays(today, 14)),
    [courses, today],
  );

  const ready = !!uid && !!serverSynced.courses && !!serverSynced.open && !!serverSynced.recent && !!serverSynced.series;

  useMaterialise({ uid, ready, today, courses, series, itemMap });

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(profile.settings || {}) }), [profile.settings]);

  const value: Store = {
    user,
    authReady,
    ready,
    uid,
    now,
    profile,
    settings,
    courses,
    courseMap,
    items,
    itemMap,
    series,
    attendance,
    days,
    timer,
    sessions,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Generates the auto-managed work: weekly assignment instances and
 * "read the textbook" tasks for each class day. IDs are deterministic and
 * creation is transactional, so any number of devices can run this.
 */
function useMaterialise({
  uid,
  ready,
  today,
  courses,
  series,
  itemMap,
}: {
  uid: string;
  ready: boolean;
  today: string;
  courses: Course[];
  series: Series[];
  itemMap: Map<string, Item>;
}) {
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!uid || !ready) return;
    const jobs: { id: string; data: Omit<Item, "id"> }[] = [];
    const from = addDays(today, -14);
    for (const s of series) {
      if (!s.active) continue;
      for (const occ of seriesOccurrences(s, from, addDays(today, 14))) {
        const id = seriesItemId(s.id, occ.date);
        if (itemMap.has(id) || tried.current.has(id)) continue;
        jobs.push({
          id,
          data: {
            kind: "assignment",
            title: s.title,
            courseId: s.courseId,
            due: occ.due,
            lateDue: occ.lateDue,
            subtasks: [],
            status: "open",
            createdAt: Date.now(),
            seriesId: s.id,
          },
        });
      }
    }
    for (const c of courses) {
      for (const date of textbookDates(c, from, today)) {
        const id = textbookItemId(c.id, date);
        if (itemMap.has(id) || tried.current.has(id)) continue;
        const book = c.textbook.title ? ` — ${c.textbook.title}` : "";
        jobs.push({
          id,
          data: {
            kind: "textbook",
            title: `Read & take notes${book}`,
            courseId: c.id,
            due: atTime(date, "23:59"),
            subtasks: [
              { id: "read", title: "Read today's section", done: false },
              { id: "notes", title: "Write notes in your own words", done: false },
            ],
            status: "open",
            createdAt: Date.now(),
            classDate: date,
          },
        });
      }
    }
    for (const j of jobs) {
      tried.current.add(j.id);
      createIfMissing(uid, j.id, j.data).catch(() => tried.current.delete(j.id));
    }
  }, [uid, ready, today, courses, series, itemMap]);
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

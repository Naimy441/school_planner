export type ColorKey =
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export type TextbookKind = "none" | "physical" | "link" | "file";

export interface Textbook {
  kind: TextbookKind;
  title?: string;
  url?: string;
  /** YYYY-MM-DD — textbook tasks are generated for class days from here on. */
  since?: string;
}

/** A weekly-repeating class meeting (lecture, lab, ...). */
export interface Meeting {
  id: string;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** "HH:mm", local time */
  start: string;
  end: string;
  location?: string;
  /** YYYY-MM-DD inclusive range */
  startDate: string;
  endDate: string;
  /** every N weeks (default 1) */
  interval?: number;
  /** YYYY-MM-DD dates with no class */
  exdates?: string[];
  label?: string;
}

/** A bookmark that belongs to a class (syllabus, LMS page, slides, …). */
export interface CourseLink {
  id: string;
  title?: string;
  url: string;
}

export interface Course {
  id: string;
  name: string;
  code?: string;
  color: ColorKey;
  location?: string;
  textbook: Textbook;
  meetings: Meeting[];
  links?: CourseLink[];
  createdAt: number;
  source?: "ics" | "manual";
}

export type ItemKind = "assignment" | "exam" | "textbook" | "task";
export type ItemStatus = "open" | "done" | "archived";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  doneAt?: number | null;
}

export interface Prep {
  /** when the user confirmed readiness (ms) — readiness expires after a few hours */
  at: number;
  place: boolean;
  distractions: boolean;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  courseId?: string | null;
  /** deadline (ms). For exams: when the exam starts. */
  due: number;
  /** optional second, late deadline (ms) — once it passes we ask whether it was turned in. */
  lateDue?: number | null;
  /** where the exam takes place */
  where?: string;
  /** where the user plans to work on it */
  place?: string;
  reward?: string;
  notes?: string;
  subtasks: Subtask[];
  status: ItemStatus;
  completedAt?: number | null;
  createdAt: number;
  seriesId?: string | null;
  /** textbook tasks: the class day they belong to */
  classDate?: string | null;
  prep?: Prep | null;
  focusMs?: number;
  /** completion points already granted (so re-completing doesn't double up) */
  rewarded?: boolean;
  /** "arrived at place" points granted for the current prep */
  arriveAwardedAt?: number | null;
  /** "distractions away" points granted for the current prep */
  calmAwardedAt?: number | null;
}

/** Weekly recurring assignment template; instances are materialised as Items. */
export interface Series {
  id: string;
  courseId: string;
  title: string;
  days: number[];
  time: string;
  startDate: string;
  endDate: string;
  /** late deadline = each due time + this many minutes (null = no late work) */
  lateOffsetMin?: number | null;
  /** legacy: whole days of late window (read-only, superseded by lateOffsetMin) */
  lateDays?: number | null;
  createdAt: number;
  active: boolean;
}

export type AttendanceStatus = "attended" | "missed" | "skipped";

export interface Attendance {
  id: string;
  courseId: string;
  date: string;
  start: string;
  status: AttendanceStatus;
  at: number;
}

export type Phase = "work" | "break";

export interface TimerState {
  active: boolean;
  itemId: string | null;
  phase: Phase;
  workMin: number;
  breakMin: number;
  /** when the current phase ends (ms) — null while paused */
  endsAt: number | null;
  /** remaining ms while paused */
  remainingMs: number | null;
  /** completed work blocks this session */
  cycle: number;
  startedAt: number;
  updatedAt: number;
}

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
/** "excused" answers the check-in without counting either way. */
export type PrayerStatus = "prayed" | "missed" | "excused";

export interface PrayerSettings {
  enabled: boolean;
  lat?: number;
  lng?: number;
  /** adhan calculation method key, e.g. "NorthAmerica" */
  method: string;
  madhab: "shafi" | "hanafi";
  /** when tracking was turned on (ms) — nothing earlier is asked about */
  since?: number;
}

export interface SleepSettings {
  enabled: boolean;
  /** "HH:mm" local */
  bed: string;
  wake: string;
}

export interface Settings {
  workMin: number;
  breakMin: number;
  sound: boolean;
  dailyGoal: number;
  prayer?: PrayerSettings;
  sleep?: SleepSettings;
}

/** One answered prayer check-in; id is `${date}_${prayer}`. */
export interface PrayerLog {
  id: string;
  date: string;
  prayer: PrayerName;
  status: PrayerStatus;
  /** answered while it was still that prayer's time */
  onTime: boolean;
  at: number;
}

export interface Profile {
  displayName?: string;
  points: number;
  focusMs: number;
  subtasksDone: number;
  itemsDone: number;
  classesAttended: number;
  classesMissed: number;
  prayersPrayed?: number;
  prayersMissed?: number;
  settings?: Partial<Settings>;
  createdAt?: number;
}

export interface DayStat {
  date: string;
  points?: number;
  focusMs?: number;
  subtasks?: number;
  items?: number;
  classes?: number;
}

/** A concrete class occurrence computed from a Meeting. */
export interface ClassSession {
  id: string;
  courseId: string;
  meetingId: string;
  date: string;
  startTime: string;
  start: number;
  end: number;
  location?: string;
}

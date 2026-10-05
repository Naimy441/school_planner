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

export interface Course {
  id: string;
  name: string;
  code?: string;
  color: ColorKey;
  location?: string;
  textbook: Textbook;
  meetings: Meeting[];
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
  /** optional second, late deadline (ms) — after it passes the item drops off. */
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

export interface Settings {
  workMin: number;
  breakMin: number;
  sound: boolean;
  dailyGoal: number;
}

export interface Profile {
  displayName?: string;
  points: number;
  focusMs: number;
  subtasksDone: number;
  itemsDone: number;
  classesAttended: number;
  classesMissed: number;
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

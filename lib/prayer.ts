import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import { addDays, atTime, dayKey, HOUR, parseDay } from "./dates";
import type { PrayerLog, PrayerName, PrayerSettings, SleepSettings } from "./types";

export const PRAYERS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const METHODS = {
  NorthAmerica: "North America (ISNA)",
  MuslimWorldLeague: "Muslim World League",
  Egyptian: "Egyptian General Authority",
  Karachi: "University of Islamic Sciences, Karachi",
  UmmAlQura: "Umm al-Qura, Makkah",
  Dubai: "Dubai",
  MoonsightingCommittee: "Moonsighting Committee",
  Kuwait: "Kuwait",
  Qatar: "Qatar",
  Singapore: "Singapore",
  Tehran: "Tehran",
  Turkey: "Turkey (Diyanet)",
} as const;
export type MethodKey = keyof typeof METHODS;

/** A sensible starting method from the device's time zone; the user can change it. */
export function defaultMethod(): MethodKey {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (tz.startsWith("America/")) return "NorthAmerica";
  if (tz === "Africa/Cairo") return "Egyptian";
  if (tz === "Asia/Karachi" || tz === "Asia/Kolkata" || tz === "Asia/Dhaka") return "Karachi";
  if (tz === "Asia/Riyadh") return "UmmAlQura";
  if (tz === "Asia/Dubai") return "Dubai";
  if (tz === "Asia/Qatar") return "Qatar";
  if (tz === "Asia/Kuwait") return "Kuwait";
  if (tz === "Asia/Singapore" || tz === "Asia/Kuala_Lumpur" || tz === "Asia/Jakarta") return "Singapore";
  if (tz === "Asia/Tehran") return "Tehran";
  if (tz === "Europe/Istanbul") return "Turkey";
  return "MuslimWorldLeague";
}

/** One prayer on one day: from its time until the next prayer (Fajr ends at sunrise, Isha at the next Fajr). */
export interface PrayerWindow {
  id: string;
  date: string;
  prayer: PrayerName;
  start: number;
  end: number;
}

export const prayerId = (date: string, prayer: PrayerName) => `${date}_${prayer}`;

function timesFor(p: PrayerSettings, date: string) {
  const params = CalculationMethod[(p.method in METHODS ? p.method : "MuslimWorldLeague") as MethodKey]();
  params.madhab = p.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return new PrayerTimes(new Coordinates(p.lat!, p.lng!), parseDay(date), params);
}

export function prayerReady(p?: PrayerSettings): p is PrayerSettings & { lat: number; lng: number } {
  return !!p?.enabled && typeof p.lat === "number" && typeof p.lng === "number";
}

export function windowsFor(p: PrayerSettings, date: string): PrayerWindow[] {
  const t = timesFor(p, date);
  const nextFajr = timesFor(p, addDays(date, 1)).fajr.getTime();
  const at = { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
  const ends = { fajr: t.sunrise, dhuhr: t.asr, asr: t.maghrib, maghrib: t.isha, isha: new Date(nextFajr) };
  return PRAYERS.map((prayer) => ({
    id: prayerId(date, prayer),
    date,
    prayer,
    start: at[prayer].getTime(),
    end: ends[prayer].getTime(),
  }));
}

/** Yesterday's and today's prayers (yesterday's Isha runs past midnight). */
export function recentWindows(p: PrayerSettings | undefined, now: number) {
  if (!prayerReady(p)) return [];
  const today = dayKey(now);
  return [...windowsFor(p, addDays(today, -1)), ...windowsFor(p, today)];
}

/** The prayer whose time it is right now and that hasn't been answered. */
export function currentPrayer(windows: PrayerWindow[], logs: Map<string, PrayerLog>, now: number) {
  return windows.find((w) => now >= w.start && now < w.end && !logs.has(w.id)) || null;
}

/** Prayers whose time ended unanswered (only since tracking was turned on, and not too far back). */
export function unansweredPast(windows: PrayerWindow[], logs: Map<string, PrayerLog>, since: number, now: number) {
  return windows.filter((w) => w.end <= now && w.end > since && w.start >= now - 30 * HOUR && !logs.has(w.id));
}

/** Is `now` between bedtime and wake-up (the range may cross midnight)? */
export function inSleepWindow(s: SleepSettings | undefined, now: number) {
  if (!s?.enabled || !s.bed || !s.wake || s.bed === s.wake) return false;
  const today = dayKey(now);
  const bed = atTime(today, s.bed);
  const wake = atTime(today, s.wake);
  return bed < wake ? now >= bed && now < wake : now >= bed || now < wake;
}

"use client";

import { signOut } from "firebase/auth";
import { CalendarPlus, ChevronRight, Eye, EyeOff, LocateFixed, LogOut, Monitor, MoonStar, Smartphone, Sparkles, Sun, Volume2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { updateSettings } from "@/lib/actions";
import { auth } from "@/lib/firebase";
import { dayKey, fmtTime } from "@/lib/dates";
import { defaultMethod, METHODS, PRAYER_LABEL, windowsFor, type MethodKey } from "@/lib/prayer";
import { useStore } from "@/lib/store";
import { DEFAULT_AI_MODEL } from "@/lib/syllabus";
import type { PrayerSettings, SleepSettings } from "@/lib/types";
import { fmtSettingTime, PRAYER_ICON } from "./prayer";
import { PRESETS } from "./start-flow";
import { Button, cn, IconButton, inputCls, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function SettingsSheet() {
  const ui = useUI();
  const { user, uid, settings } = useStore();
  const close = () => ui.setSettingsOpen(false);
  return (
    <Sheet open={ui.settingsOpen} onClose={close} mode="center" label="Settings">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-ink">Settings</h3>
          <IconButton label="Close" onClick={close}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-app/50 p-3">
          {user?.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-ink">{user?.displayName}</div>
            <div className="truncate text-[12.5px] text-ink-3">{user?.email}</div>
          </div>
        </div>

        <button
          onClick={() => {
            close();
            ui.setImportOpen(true);
          }}
          className="mt-3 flex w-full items-center justify-between rounded-lg bg-hover px-3 py-2.5 text-left text-[14px] text-ink hover:bg-press"
        >
          <span className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-ink-2" /> Import timetable (.ics)
          </span>
          <ChevronRight className="h-4 w-4 text-ink-3" />
        </button>

        <div className="mt-6 text-[12.5px] font-medium text-ink-2">Default rhythm</div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => {
            const on = settings.workMin === p.work && settings.breakMin === p.rest;
            return (
              <button
                key={p.label}
                onClick={() => updateSettings(uid, { workMin: p.work, breakMin: p.rest })}
                className={cn(
                  "tnum rounded-md border py-2 text-[13px] font-medium transition-colors",
                  on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:bg-hover",
                )}
              >
                {p.work}/{p.rest}
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-[12.5px] font-medium text-ink-2">Daily points goal</div>
        <div className="mt-2 flex gap-1.5">
          {[100, 150, 250, 400].map((g) => (
            <button
              key={g}
              onClick={() => updateSettings(uid, { dailyGoal: g })}
              className={cn(
                "tnum flex-1 rounded-md border py-2 text-[13px] font-medium transition-colors",
                settings.dailyGoal === g ? "border-gold bg-gold-soft text-ink" : "border-line text-ink-2 hover:bg-hover",
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <label className="mt-6 flex cursor-pointer items-center justify-between rounded-lg bg-hover px-3 py-2.5">
          <span className="flex items-center gap-2 text-[14px] text-ink">
            <Volume2 className="h-4 w-4 text-ink-2" /> Chime when a block ends
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => updateSettings(uid, { sound: e.target.checked })}
            className="h-4 w-4 accent-[#2383e2]"
          />
        </label>

        <PrayerSettingsBlock />
        <SleepSettingsBlock />
        <AISettingsBlock />

        <div className="mt-6 rounded-xl border border-line bg-app/50 p-3.5 text-[13px] leading-relaxed text-ink-2">
          <div className="mb-1 flex items-center gap-2 font-medium text-ink">
            <Smartphone className="h-4 w-4" /> Add to your iPhone
          </div>
          In Safari, tap Share → <b className="text-ink">Add to Home Screen</b>. It opens full-screen like an app and stays in sync.
          <div className="mb-1 mt-3 flex items-center gap-2 font-medium text-ink">
            <Monitor className="h-4 w-4" /> Mac menu bar
          </div>
          Run the Planner Bar app, then{" "}
          <Link href="/link-widget" onClick={close} className="text-accent underline-offset-2 hover:underline">
            connect it here
          </Link>
          .
        </div>

        <Button
          variant="danger"
          className="mt-6 w-full"
          icon={<LogOut className="h-4 w-4" />}
          onClick={() => {
            close();
            signOut(auth());
          }}
        >
          Sign out
        </Button>
      </div>
    </Sheet>
  );
}

function Toggle({ icon, label, checked, onChange }: { icon: ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg bg-hover px-3 py-2.5">
      <span className="flex items-center gap-2 text-[14px] text-ink">
        {icon} {label}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#2383e2]" />
    </label>
  );
}

const selectCls = cn(inputCls, "pr-2");

function PrayerSettingsBlock() {
  const { uid, settings, now } = useStore();
  const ui = useUI();
  const [locating, setLocating] = useState(false);
  const cur: PrayerSettings = settings.prayer || { enabled: false, method: defaultMethod(), madhab: "shafi" };
  const save = (patch: Partial<PrayerSettings>) =>
    updateSettings(uid, { prayer: { ...cur, ...patch } }).catch(() => ui.toast("Couldn't save — check your connection"));

  const locate = () => {
    if (!("geolocation" in navigator)) return ui.toast("This device can't share its location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // ~100 m is plenty for prayer times and keeps the stored location coarse
        const round = (n: number) => Math.round(n * 1000) / 1000;
        save({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
      },
      () => {
        setLocating(false);
        ui.toast("Couldn't get your location — allow it for this site and try again");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60 * 60_000 },
    );
  };

  const hasLocation = typeof cur.lat === "number" && typeof cur.lng === "number";
  const today = hasLocation ? windowsFor(cur, dayKey(now)) : [];

  return (
    <div className="mt-6">
      <Toggle
        icon={<Sun className="h-4 w-4 text-ink-2" />}
        label="Prayer check-ins"
        checked={cur.enabled}
        onChange={(enabled) => {
          // Only ask about prayers from the moment tracking is (re)enabled.
          save({ enabled, ...(enabled ? { since: Date.now() } : {}) });
          if (enabled && !hasLocation) locate();
        }}
      />
      {cur.enabled && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-ink-2">
              {hasLocation ? `Location · ${cur.lat!.toFixed(2)}, ${cur.lng!.toFixed(2)}` : "Prayer times need your location"}
            </span>
            <Button variant={hasLocation ? "ghost" : "primary"} size="sm" icon={<LocateFixed className="h-3.5 w-3.5" />} onClick={locate} disabled={locating}>
              {locating ? "Locating…" : hasLocation ? "Update" : "Use my location"}
            </Button>
          </div>
          <label className="text-[12px] text-ink-3">
            Calculation method
            <select value={cur.method} onChange={(e) => save({ method: e.target.value as MethodKey })} className={cn(selectCls, "mt-1")}>
              {Object.entries(METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-ink-3">
            Asr time
            <select value={cur.madhab} onChange={(e) => save({ madhab: e.target.value as PrayerSettings["madhab"] })} className={cn(selectCls, "mt-1")}>
              <option value="shafi">Standard (Shafi&apos;i, Maliki, Hanbali)</option>
              <option value="hanafi">Hanafi (later Asr)</option>
            </select>
          </label>
          {today.length > 0 && (
            <div className="mt-1 grid grid-cols-5 gap-1 text-center">
              {today.map((w) => {
                const Icon = PRAYER_ICON[w.prayer];
                return (
                  <div key={w.id} className="rounded-md bg-hover px-1 py-1.5">
                    <Icon className="mx-auto h-3.5 w-3.5 text-ink-3" />
                    <div className="mt-0.5 text-[11px] font-medium text-ink-2">{PRAYER_LABEL[w.prayer]}</div>
                    <div className="tnum text-[11px] text-ink-3">{fmtTime(w.start)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The user's own OpenAI key, for reading syllabi. */
function AISettingsBlock() {
  const { uid, settings } = useStore();
  const ui = useUI();
  const [key, setKey] = useState(settings.openaiKey || "");
  const [model, setModel] = useState(settings.openaiModel || "");
  const [show, setShow] = useState(false);
  const save = (patch: { openaiKey?: string; openaiModel?: string }) =>
    updateSettings(uid, patch)
      .then(() => ui.toast("Saved"))
      .catch(() => ui.toast("Couldn't save — check your connection"));
  return (
    <div className="mt-3 rounded-lg border border-line p-3">
      <div className="flex items-center gap-2 text-[14px] text-ink">
        <Sparkles className="h-4 w-4 text-ink-2" /> Syllabus reader (OpenAI)
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
        Your own API key from{" "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          platform.openai.com
        </a>
        . Saved to your account and only sent to OpenAI when you read a syllabus.
      </p>
      <label className="mt-2 block text-[12px] text-ink-3">
        API key
        <div className="mt-1 flex gap-1.5">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => key.trim() !== (settings.openaiKey || "") && save({ openaiKey: key.trim() })}
            placeholder="sk-…"
            className={cn(inputCls, "min-w-0 flex-1")}
          />
          <IconButton label={show ? "Hide key" : "Show key"} className="h-9 w-9" onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </IconButton>
        </div>
      </label>
      <label className="mt-2 block text-[12px] text-ink-3">
        Model
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => model.trim() !== (settings.openaiModel || "") && save({ openaiModel: model.trim() })}
          placeholder={DEFAULT_AI_MODEL}
          className={cn(inputCls, "mt-1")}
        />
      </label>
    </div>
  );
}

function SleepSettingsBlock() {
  const { uid, settings } = useStore();
  const ui = useUI();
  const cur: SleepSettings = settings.sleep || { enabled: false, bed: "23:00", wake: "07:00" };
  const save = (patch: Partial<SleepSettings>) =>
    updateSettings(uid, { sleep: { ...cur, ...patch } }).catch(() => ui.toast("Couldn't save — check your connection"));
  return (
    <div className="mt-3">
      <Toggle icon={<MoonStar className="h-4 w-4 text-ink-2" />} label="Bedtime reminder" checked={cur.enabled} onChange={(enabled) => save({ enabled })} />
      {cur.enabled && (
        <div className="mt-2 rounded-lg border border-line p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-ink-3">
              Bedtime
              <input type="time" value={cur.bed} onChange={(e) => e.target.value && save({ bed: e.target.value })} className={cn(inputCls, "mt-1")} />
            </label>
            <label className="text-[12px] text-ink-3">
              Wake up
              <input type="time" value={cur.wake} onChange={(e) => e.target.value && save({ wake: e.target.value })} className={cn(inputCls, "mt-1")} />
            </label>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            Open the app between {fmtSettingTime(cur.bed)} and {fmtSettingTime(cur.wake)} and you&apos;ll get a gentle nudge to get some rest.
          </p>
        </div>
      )}
    </div>
  );
}

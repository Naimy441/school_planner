"use client";

import { signOut } from "firebase/auth";
import { LogOut, Monitor, Smartphone, Volume2, X } from "lucide-react";
import Link from "next/link";
import { updateSettings } from "@/lib/actions";
import { auth } from "@/lib/firebase";
import { useStore } from "@/lib/store";
import { PRESETS } from "./start-flow";
import { Button, cn, IconButton, Sheet } from "./ui";
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

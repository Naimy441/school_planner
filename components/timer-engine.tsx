"use client";

import { useEffect, useRef, useState } from "react";
import { advanceTimer, remainingOf } from "@/lib/actions";
import { fmtClock } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { useUI } from "./ui-state";

/** Re-render every `ms` (null = paused). Returns the current time. */
export function useTick(ms: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (ms == null) return;
    const kick = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

let audioCtx: AudioContext | null = null;

function ensureAudio() {
  if (audioCtx || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
}

/** Soft two-note chime, synthesised so there's no asset to load. */
export function chime(kind: "work" | "break") {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  const notes = kind === "break" ? [659.25, 880] : [880, 659.25, 783.99];
  notes.forEach((f, i) => {
    const t = audioCtx!.currentTime + i * 0.18;
    const o = audioCtx!.createOscillator();
    const g = audioCtx!.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(audioCtx!.destination);
    o.start(t);
    o.stop(t + 1);
  });
}

/**
 * Headless: advances the synced timer when a phase hits zero, chimes, and
 * mirrors the countdown into the tab title.
 */
export function TimerEngine() {
  const { timer, uid, settings, itemMap } = useStore();
  const { toast } = useUI();
  const now = useTick(timer?.active ? 500 : null);
  const handled = useRef<string>("");

  useEffect(() => {
    const unlock = () => ensureAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!timer?.active || timer.endsAt == null || !uid) return;
    if (now < timer.endsAt) return;
    const key = `${timer.phase}:${timer.endsAt}`;
    if (handled.current === key) return;
    handled.current = key;
    const fresh = now - timer.endsAt < 90_000;
    if (fresh) {
      if (settings.sound) chime(timer.phase === "work" ? "break" : "work");
      navigator.vibrate?.([30, 60, 30]);
      toast(timer.phase === "work" ? "Block done — enjoy your break ☕" : "Break's over — back to it 💪");
    }
    advanceTimer(uid, timer).catch(() => {
      handled.current = "";
    });
  }, [now, timer, uid, settings.sound, toast]);

  useEffect(() => {
    const base = "Planner";
    if (!timer?.active) {
      document.title = base;
      return;
    }
    const item = timer.itemId ? itemMap.get(timer.itemId) : null;
    const label = timer.phase === "work" ? "Focus" : "Break";
    const paused = timer.endsAt == null ? "❚❚ " : "";
    document.title = `${paused}${fmtClock(remainingOf(timer, now))} · ${label}${item ? ` — ${item.title}` : ""}`;
  }, [now, timer, itemMap]);

  return null;
}

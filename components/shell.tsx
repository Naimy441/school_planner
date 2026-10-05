"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronLeft, ClipboardList, FileText, ListChecks, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { remainingOf } from "@/lib/actions";
import { fmtClock } from "@/lib/dates";
import { levelInfo } from "@/lib/points";
import { useStore } from "@/lib/store";
import { useTick } from "./timer-engine";
import { AnimatedNumber, cn, Ring, spring, useDocked } from "./ui";
import { useUI } from "./ui-state";

export function PointsPill({ compact = false }: { compact?: boolean }) {
  const { profile } = useStore();
  const lvl = levelInfo(profile.points);
  const path = usePathname();
  const [bump, setBump] = useState(0);
  const prev = useRef(profile.points);
  useEffect(() => {
    if (profile.points > prev.current) setBump((b) => b + 1);
    prev.current = profile.points;
  }, [profile.points]);
  return (
    <Link
      href="/#progress"
      className="focus-ring rounded-full"
      aria-label="Your progress"
      onClick={(e) => {
        // The hash doesn't change on a second press, so the browser wouldn't scroll again — do it ourselves.
        const el = document.getElementById("progress");
        if (path !== "/" || !el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      <motion.div
        key={bump}
        animate={bump ? { scale: [1, 1.12, 1] } : undefined}
        transition={{ duration: 0.45 }}
        className={cn(
          "flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 transition-colors hover:bg-card",
          compact && "pr-2.5",
        )}
      >
        <Ring value={lvl.progress} size={26} stroke={3} color="var(--gold)">
          <span className="text-[10px] font-bold text-gold">{lvl.level}</span>
        </Ring>
        <AnimatedNumber value={profile.points} className="text-[13px] font-semibold text-ink" />
      </motion.div>
    </Link>
  );
}

function TimerBadge() {
  const { timer } = useStore();
  const now = useTick(timer?.active ? 1000 : null);
  if (!timer?.active) return null;
  const rem = remainingOf(timer, now);
  return (
    <span
      className={cn(
        "tnum rounded-full px-2.5 py-1 text-[12px] font-semibold",
        timer.phase === "work" ? "bg-accent-soft text-accent" : "bg-good-soft text-good",
      )}
    >
      {timer.endsAt == null ? "❚❚ " : ""}
      {fmtClock(rem)}
    </span>
  );
}

function QuickAdd() {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", f);
    return () => window.removeEventListener("pointerdown", f);
  }, [open]);
  const opts = [
    { label: "Assignment", icon: FileText, run: () => ui.openNewItem({ kind: "assignment" }) },
    { label: "Exam", icon: ClipboardList, run: () => ui.openNewItem({ kind: "exam" }) },
    { label: "Task", icon: ListChecks, run: () => ui.openNewItem({ kind: "task" }) },
    { label: "Class", icon: BookOpen, run: () => ui.setNewCourse(true) },
    { label: "From a syllabus", icon: Sparkles, run: () => ui.openSyllabus("") },
  ];
  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Add"
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_20px_rgba(35,131,226,0.35)]"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={spring}>
          <Plus className="h-5 w-5" />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-50 w-48 origin-top-right overflow-hidden rounded-lg border border-line bg-card-2 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          >
            {opts.map((o) => (
              <button
                key={o.label}
                onClick={() => {
                  setOpen(false);
                  o.run();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink hover:bg-hover"
              >
                <o.icon className="h-4 w-4 text-ink-2" />
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar() {
  const { user } = useStore();
  const ui = useUI();
  const letter = (user?.displayName || user?.email || "?")[0]?.toUpperCase();
  return (
    <button
      onClick={() => ui.setSettingsOpen(true)}
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-card-2 text-[13px] font-semibold text-ink-2"
      aria-label="Settings"
    >
      {user?.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        letter
      )}
    </button>
  );
}

/** Back to Home from the few screens that aren't it (the focus session, widget linking). */
function HomeButton() {
  const path = usePathname();
  if (path === "/") return null;
  return (
    <Link
      href="/"
      className="focus-ring flex h-8 items-center gap-1 rounded-md pl-1 pr-2 text-[14px] text-ink-2 hover:bg-hover hover:text-ink"
    >
      <ChevronLeft className="h-4 w-4" />
      Home
    </Link>
  );
}

/** While a session runs, a live countdown that leads back to it. */
function FocusChip() {
  const path = usePathname();
  const { timer } = useStore();
  if (!timer?.active || path === "/focus") return null;
  return (
    <Link href="/focus" aria-label="Back to focus session" className="focus-ring relative flex items-center rounded-full">
      <TimerBadge />
    </Link>
  );
}

function Header() {
  return (
    <header className="pt-safe sticky top-0 z-40 bg-app/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-[760px] items-center justify-between gap-3 px-4 sm:px-8 md:h-14">
        <div className="flex items-center gap-2">
          <Avatar />
          <HomeButton />
        </div>
        <div className="flex items-center gap-2">
          <FocusChip />
          <PointsPill compact />
          <QuickAdd />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  // On desktop an open task or class docks on the right and the page slides over to make room.
  const docked = useDocked();
  return (
    <div
      className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ paddingRight: docked ? "var(--dock-w)" : 0 }}
    >
      <Header />
      {children}
    </div>
  );
}

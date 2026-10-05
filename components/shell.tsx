"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Plus,
  Settings as SettingsIcon,
  Timer,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { remainingOf } from "@/lib/actions";
import { fmtClock } from "@/lib/dates";
import { levelInfo } from "@/lib/points";
import { useStore } from "@/lib/store";
import { useTick } from "./timer-engine";
import { AnimatedNumber, cn, Dot, Ring, spring } from "./ui";
import { useUI } from "./ui-state";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/today", label: "Today", icon: ListChecks },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/classes", label: "Classes", icon: GraduationCap },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function PointsPill({ compact = false }: { compact?: boolean }) {
  const { profile } = useStore();
  const lvl = levelInfo(profile.points);
  const [bump, setBump] = useState(0);
  const prev = useRef(profile.points);
  useEffect(() => {
    if (profile.points > prev.current) setBump((b) => b + 1);
    prev.current = profile.points;
  }, [profile.points]);
  return (
    <Link href="/progress" className="focus-ring">
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
        "tnum rounded-md px-1.5 py-[1px] text-[11px] font-semibold",
        timer.phase === "work" ? "bg-accent-soft text-accent" : "bg-good-soft text-good",
      )}
    >
      {timer.endsAt == null ? "❚❚ " : ""}
      {fmtClock(rem)}
    </span>
  );
}

function QuickAdd({ align = "right" }: { align?: "left" | "right" }) {
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
    { label: "Import .ics", icon: Upload, run: () => ui.setImportOpen(true) },
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
            className={cn(
              "absolute top-11 z-50 w-48 overflow-hidden rounded-lg border border-line bg-card-2 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]",
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
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

function Sidebar() {
  const isActive = useActive();
  const { user, courses } = useStore();
  const ui = useUI();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-panel md:flex">
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-4">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{user?.displayName?.split(" ")[0] || "You"}&apos;s Planner</div>
        </div>
        <QuickAdd align="left" />
      </div>
      <nav className="mt-2 flex flex-col gap-[2px] px-2">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "relative flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors",
                active ? "text-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-md bg-press" transition={spring} />}
              <n.icon className="relative h-[17px] w-[17px]" />
              <span className="relative flex-1">{n.label}</span>
              {n.href === "/focus" && (
                <span className="relative">
                  <TimerBadge />
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 px-4 text-[12px] font-medium text-ink-3">Classes</div>
      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[1px] overflow-y-auto px-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => ui.openCourse(c.id)}
            className="flex h-[28px] items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Dot color={c.color} />
            <span className="truncate">{c.code || c.name}</span>
          </button>
        ))}
        <button
          onClick={() => ui.setNewCourse(true)}
          className="flex h-[28px] items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] text-ink-3 hover:bg-hover hover:text-ink-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add class
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line p-3">
        <PointsPill />
        <button
          onClick={() => ui.setSettingsOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
          aria-label="Settings"
        >
          <SettingsIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
    </aside>
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

function MobileHeader() {
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-transparent bg-app/80 backdrop-blur-xl md:hidden">
      <div className="flex h-12 items-center justify-between gap-3 px-4">
        <Avatar />
        <div className="flex items-center gap-2">
          <PointsPill compact />
          <QuickAdd />
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  const isActive = useActive();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgba(25,25,25,0.82)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-[520px] items-stretch justify-around px-1">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link key={n.href} href={n.href} className="relative flex flex-1 flex-col items-center gap-[3px] pb-1.5 pt-2">
              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-ink"
                  transition={spring}
                />
              )}
              <motion.span whileTap={{ scale: 0.85 }} className={cn("relative", active ? "text-ink" : "text-ink-3")}>
                <n.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {n.href === "/focus" && <FocusDot />}
              </motion.span>
              <span className={cn("text-[10px] font-medium", active ? "text-ink" : "text-ink-3")}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function FocusDot() {
  const { timer } = useStore();
  if (!timer?.active) return null;
  return (
    <span
      className={cn(
        "pulse-ring absolute -right-1 -top-0.5 h-2 w-2 rounded-full",
        timer.phase === "work" ? "bg-accent text-accent" : "bg-good text-good",
      )}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        {children}
      </div>
      <TabBar />
    </div>
  );
}

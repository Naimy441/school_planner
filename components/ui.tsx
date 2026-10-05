"use client";

import clsx from "clsx";
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { forwardRef, useEffect, useId, useRef, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colorOf } from "@/lib/colors";

export const cn = clsx;

export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;
export const softSpring = { type: "spring", stiffness: 220, damping: 28 } as const;

// ---------- Buttons ----------

type BtnVariant = "primary" | "secondary" | "ghost" | "good" | "subtle" | "danger";

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={disabled}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        variant === "primary" && "bg-accent text-white hover:bg-[#1f76cc]",
        variant === "secondary" && "border border-line bg-card text-ink hover:bg-card-2",
        variant === "ghost" && "text-ink-2 hover:bg-hover hover:text-ink",
        variant === "subtle" && "bg-hover text-ink hover:bg-press",
        variant === "good" && "bg-good text-white hover:brightness-110",
        variant === "danger" && "text-danger hover:bg-[rgba(224,92,89,0.12)]",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
});

export function IconButton({
  className,
  children,
  label,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> & {
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={spring}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-hover hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("focus-ring relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-white/15")}
    >
      <motion.span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow"
        animate={{ left: checked ? 21 : 3 }}
        transition={spring}
      />
    </button>
  );
}

/** A label + switch row. */
export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-hover px-3 py-2.5">
      <span className="text-[14px] text-ink">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

// ---------- Tags ----------

export function Tag({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  const c = colorOf(color);
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1.5 truncate rounded-[5px] px-1.5 py-[1px] text-[12px] font-medium leading-5", className)}
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color?: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: colorOf(color).dot }} />;
}

// ---------- Check ----------

export function Check({
  checked,
  onChange,
  size = 22,
  color = "var(--good)",
  round = true,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean, e: React.MouseEvent) => void;
  size?: number;
  color?: string;
  round?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label || "Toggle"}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked, e);
      }}
      whileTap={{ scale: 0.82 }}
      animate={{ scale: checked ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.32 }}
      className={cn(
        "focus-ring relative inline-flex shrink-0 items-center justify-center border-[1.5px] transition-colors duration-200",
        round ? "rounded-full" : "rounded-[5px]",
        !checked && "border-ink-3 hover:border-ink-2 hover:bg-hover",
      )}
      style={{
        width: size,
        height: size,
        background: checked ? color : undefined,
        borderColor: checked ? color : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        />
      </svg>
    </motion.button>
  );
}

// ---------- Progress ----------

export function Bar({
  value,
  color = "var(--accent)",
  height = 6,
  className,
  track = "rgba(255,255,255,0.07)",
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
  track?: string;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full", className)} style={{ height, background: track }}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 20 }}
      />
      {v >= 1 && (
        <motion.div
          className="absolute inset-0"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.1, ease: "easeInOut", delay: 0.3 }}
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
        />
      )}
    </div>
  );
}

export function Ring({
  value,
  size = 44,
  stroke = 4,
  color = "var(--accent)",
  track = "rgba(255,255,255,0.08)",
  children,
  spin = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  spin?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={spin ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={spin ? { duration: 0.25, ease: "linear" } : { type: "spring", stiffness: 70, damping: 18 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export function AnimatedNumber({ value, className, format }: { value: number; className?: string; format?: (n: number) => string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => (format ? format(Math.round(v)) : Math.round(v).toLocaleString()));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={cn("tnum", className)}>{text}</motion.span>;
}

// ---------- Sheet (bottom sheet on phones, side peek on desktop) ----------

const noopSubscribe = () => () => {};

/** true after hydration (safe for portals). */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 900px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 900px)").matches, () => false);
}

/**
 * Sheets can overlap (e.g. "new" closes while the item opens, or the repeat
 * editor sits on top of an item). Track them all and unlock page scrolling
 * only when the last one closes.
 */
const openSheets: symbol[] = [];

function syncScrollLock() {
  document.body.style.overflow = openSheets.length ? "hidden" : "";
}

export function Sheet({
  open,
  onClose,
  children,
  mode = "peek",
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  mode?: "peek" | "center";
  label?: string;
}) {
  const desktop = useIsDesktop();
  const mounted = useIsClient();

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol("sheet");
    openSheets.push(id);
    syncScrollLock();
    // Escape closes only the top-most sheet.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openSheets[openSheets.length - 1] === id && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openSheets.splice(openSheets.indexOf(id), 1);
      syncScrollLock();
    };
  }, [open]);

  if (!mounted) return null;

  const panel = desktop
    ? mode === "peek"
      ? {
          className:
            "fixed right-0 top-0 bottom-0 z-[61] flex w-[min(620px,92vw)] flex-col border-l border-line bg-panel shadow-[-24px_0_60px_rgba(0,0,0,0.45)]",
          initial: { x: "100%" },
          animate: { x: 0 },
          exit: { x: "100%" },
        }
      : {
          className:
            "fixed left-1/2 top-[10vh] z-[61] flex max-h-[80vh] w-[min(560px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)]",
          initial: { opacity: 0, y: 16, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 10, scale: 0.98 },
        }
    : {
        className:
          "fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-[18px] border-t border-line bg-panel shadow-[0_-20px_60px_rgba(0,0,0,0.5)]",
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={panel.className}
            initial={panel.initial}
            animate={panel.animate}
            exit={panel.exit}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {!desktop && <DragHandle onClose={onClose} />}
            <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !desktop && "pb-safe")}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DragHandle({ onClose }: { onClose: () => void }) {
  // A dedicated grab strip so scrolling content never fights the dismiss gesture.
  const y = useRef<number | null>(null);
  return (
    <div
      className="flex h-6 shrink-0 cursor-grab items-center justify-center"
      onPointerDown={(e) => (y.current = e.clientY)}
      onPointerUp={(e) => {
        if (y.current != null && e.clientY - y.current > 40) onClose();
        y.current = null;
      }}
    >
      <div className="h-[5px] w-10 rounded-full bg-white/20" />
    </div>
  );
}

// ---------- Layout bits ----------

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-3 px-1", className)}>
      <h2 className="text-[13px] font-semibold tracking-wide text-ink-2">{children}</h2>
      {right}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("rounded-xl border border-line bg-panel", onClick && "cursor-pointer transition-colors hover:bg-card", className)}
    >
      {children}
    </div>
  );
}

export function PropRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[36px] items-start gap-2 py-[3px]">
      <div className="flex w-[118px] shrink-0 items-center gap-2 pt-[7px] text-[13px] text-ink-3 sm:w-[140px]">
        <span className="opacity-80 [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("inline-flex rounded-lg bg-hover p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === o.value ? "text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={id} className="absolute inset-0 rounded-md bg-card-2 shadow-sm" transition={spring} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center"
    >
      <div className="mb-3 text-ink-3 [&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {body && <p className="mt-1 max-w-[320px] text-[13px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

export const inputCls =
  "focus-ring h-9 w-full rounded-md border border-line bg-hover px-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-line-2 focus:bg-card";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("mx-auto w-full max-w-[760px] px-4 pb-32 pt-4 sm:px-8 md:pb-16 md:pt-10", className)}
    >
      {children}
    </motion.main>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Gift, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { levelInfo } from "@/lib/points";
import { AnimatedNumber, Bar, Button, useIsClient } from "./ui";

export interface CelebrateOpts {
  points: number;
  x?: number;
  y?: number;
  /** a full-screen moment (task complete) instead of a small burst */
  big?: boolean;
  title?: string;
  reward?: string;
  subtitle?: string;
  totalPoints?: number;
}

const PALETTE = ["#4d8ad8", "#56a77a", "#cfa152", "#d65e9e", "#a272d8", "#e05c59", "#d28a4f", "#ffffff"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

/** Tiny canvas confetti engine, kept outside React. */
const confetti = (() => {
  let canvas: HTMLCanvasElement | null = null;
  let parts: Particle[] = [];
  let raf: number | null = null;

  function frame() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(frame) : null;
  }

  return {
    attach(el: HTMLCanvasElement | null) {
      canvas = el;
    },
    burst(x: number, y: number, count: number, power: number) {
      if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
        const v = power * (0.45 + Math.random() * 0.75);
        parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          w: 5 + Math.random() * 5,
          h: 8 + Math.random() * 6,
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          life: 90 + Math.random() * 60,
        });
      }
      if (raf == null) raf = requestAnimationFrame(frame);
    },
  };
})();

function attachCanvas(el: HTMLCanvasElement | null) {
  confetti.attach(el);
}

type Floater = { id: number; x: number; y: number; text: string };

let listener: ((o: CelebrateOpts) => void) | null = null;

/** Fire from anywhere. */
export function celebrate(o: CelebrateOpts) {
  listener?.(o);
}

export function CelebrationLayer() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [big, setBig] = useState<CelebrateOpts | null>(null);
  const mounted = useIsClient();
  const burst = confetti.burst;

  useEffect(() => {
    listener = (o) => {
      const x = o.x ?? innerWidth / 2;
      const y = o.y ?? innerHeight / 2;
      if (o.big) {
        setBig(o);
        burst(innerWidth / 2, innerHeight * 0.42, 140, 17);
        setTimeout(() => burst(innerWidth * 0.2, innerHeight * 0.6, 50, 14), 220);
        setTimeout(() => burst(innerWidth * 0.8, innerHeight * 0.6, 50, 14), 380);
        navigator.vibrate?.([12, 40, 18]);
      } else {
        burst(x, y, o.points >= 20 ? 34 : 18, o.points >= 20 ? 10 : 7);
        navigator.vibrate?.(8);
      }
      if (o.points && !o.big) {
        const id = Date.now() + Math.random();
        setFloaters((f) => [...f, { id, x, y, text: `${o.points > 0 ? "+" : ""}${o.points}` }]);
        setTimeout(() => setFloaters((f) => f.filter((p) => p.id !== id)), 1300);
      }
    };
    return () => {
      listener = null;
    };
  }, [burst]);


  if (!mounted) return null;
  const lvl = big?.totalPoints != null ? levelInfo(big.totalPoints) : null;

  return createPortal(
    <>
      <canvas ref={attachCanvas} className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />
      <div className="pointer-events-none fixed inset-0 z-[91]">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              className="absolute -translate-x-1/2 text-[17px] font-bold text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
              style={{ left: f.x, top: f.y - 18 }}
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: 1, y: -46, scale: 1 }}
              exit={{ opacity: 0, y: -70 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {big && (
          <motion.div
            className="fixed inset-0 z-[89] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBig(null)}
          >
            <motion.div
              className="w-full max-w-[380px] rounded-2xl border border-line bg-panel p-7 text-center shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-soft text-gold"
                initial={{ rotate: -20, scale: 0.4 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.1 }}
              >
                <Sparkles className="h-8 w-8" />
              </motion.div>
              <div className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-3">{big.subtitle || "Complete"}</div>
              <h3 className="mt-1 text-xl font-semibold text-ink">{big.title || "Nice work"}</h3>
              <div className="mt-4 text-4xl font-bold text-gold">
                +<AnimatedNumberFromZero value={big.points} />
              </div>
              <div className="text-[13px] text-ink-3">points</div>
              {lvl && (
                <div className="mt-5 text-left">
                  <div className="mb-1.5 flex justify-between text-[12px] text-ink-3">
                    <span>Level {lvl.level}</span>
                    <span>{lvl.toNext} to go</span>
                  </div>
                  <Bar value={lvl.progress} color="var(--gold)" height={8} />
                </div>
              )}
              {big.reward && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-5 flex items-center gap-3 rounded-xl bg-good-soft p-3 text-left"
                >
                  <Gift className="h-5 w-5 shrink-0 text-good" />
                  <div>
                    <div className="text-[12px] text-ink-3">You earned it</div>
                    <div className="text-[15px] font-medium text-ink">{big.reward}</div>
                  </div>
                </motion.div>
              )}
              <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => setBig(null)}>
                Keep going
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

function AnimatedNumberFromZero({ value }: { value: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 150);
    return () => clearTimeout(t);
  }, [value]);
  return <AnimatedNumber value={v} />;
}

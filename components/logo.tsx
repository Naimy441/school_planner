"use client";

import { motion } from "motion/react";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-[28%] border border-line-2 bg-[linear-gradient(145deg,#2a2a2a,#1c1c1c)] shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
    >
      <svg viewBox="0 0 32 32" width={size * 0.6} height={size * 0.6} fill="none">
        <rect x="5" y="7" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.28)" />
        <rect x="5" y="14.5" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.28)" />
        <rect x="5" y="22" width="11" height="3" rx="1.5" fill="rgba(255,255,255,0.28)" />
        <motion.path
          d="M19 23.5l3 3 6-7"
          stroke="#4fae7e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

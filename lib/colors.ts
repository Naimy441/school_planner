import type { ColorKey } from "./types";

// Notion's dark-mode tag palette.
export const COLORS: Record<ColorKey, { fg: string; bg: string; dot: string }> = {
  gray: { fg: "#a3a3a3", bg: "rgba(155,155,155,0.16)", dot: "#9b9b9b" },
  brown: { fg: "#c09a82", bg: "rgba(186,133,111,0.18)", dot: "#ba856f" },
  orange: { fg: "#d9935e", bg: "rgba(199,125,72,0.2)", dot: "#d28a4f" },
  yellow: { fg: "#d6ab5e", bg: "rgba(202,152,73,0.2)", dot: "#cfa152" },
  green: { fg: "#5fb183", bg: "rgba(82,158,114,0.2)", dot: "#56a77a" },
  blue: { fg: "#6f9ce0", bg: "rgba(55,125,205,0.22)", dot: "#4d8ad8" },
  purple: { fg: "#ac7ee0", bg: "rgba(157,104,211,0.2)", dot: "#a272d8" },
  pink: { fg: "#dc6ea7", bg: "rgba(209,87,150,0.2)", dot: "#d65e9e" },
  red: { fg: "#e66a67", bg: "rgba(223,84,82,0.2)", dot: "#e05c59" },
};

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export function colorOf(key?: string) {
  return COLORS[(key as ColorKey) in COLORS ? (key as ColorKey) : "gray"];
}

/** "CS 101 — Intro to CS", without repeating the code when the name already has it. */
export function courseLabel(c: { code?: string; name: string }) {
  if (!c.code || c.name.toLowerCase().includes(c.code.toLowerCase())) return c.name;
  return `${c.code} — ${c.name}`;
}

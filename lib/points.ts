export const POINTS = {
  subtask: 10,
  arrive: 10,
  distractions: 10,
  item: 50,
  examStudy: 80,
  onTime: 25,
  classAttended: 20,
  /** per completed minute of focus */
  focusMinute: 1,
} as const;

/** Points needed to *reach* level L (L1 = 0, L2 = 100, L3 = 300, L4 = 600 …). */
export function levelThreshold(level: number) {
  return 50 * level * (level - 1);
}

export function levelInfo(points: number) {
  let level = 1;
  while (levelThreshold(level + 1) <= points) level++;
  const floor = levelThreshold(level);
  const ceil = levelThreshold(level + 1);
  return { level, floor, ceil, progress: (points - floor) / (ceil - floor), toNext: ceil - points };
}

export const LEVEL_TITLES = [
  "Getting started",
  "Warming up",
  "Building momentum",
  "In the groove",
  "Steady scholar",
  "Deep worker",
  "Focus artisan",
  "Study sage",
  "Unstoppable",
];

export function levelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

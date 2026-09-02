// ============================================================
// Achievements
// The catalog lives here, NOT in the database — adding a badge
// should never require a migration. The `achievements` table only
// records which codes a user has unlocked (and when).
//
// Every badge is expressed as value() vs target, so the UI can
// render progress for locked badges with no extra bookkeeping.
// ============================================================

import { eachDayOfInterval, format, getDay, parseISO, startOfWeek, subDays } from "date-fns";

export type Tier = "bronze" | "silver" | "gold" | "legendary";

export interface AttLike { date: string; status: string }
export interface LogLike { date: string; status: string; client_or_project: string | null }

export interface AchievementStats {
  daysLogged: number;
  showUpDays: number;
  currentStreak: number;
  longestStreak: number;
  totalLogs: number;
  doneCount: number;
  wfhDays: number;
  distinctProjects: number;
  perfectWeeks: number;
  bestMonthDays: number;
  comebacks: number;
}

export interface AchievementDef {
  code: string;
  name: string;
  desc: string;
  iconText: string;
  tier: Tier;
  target: number;
  value: (s: AchievementStats) => number;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const SHOW_UP = new Set(["PRESENT", "WFH", "HALF_DAY"]);

/**
 * Streaks skip weekends. A Saturday you didn't work shouldn't cost
 * you a streak you otherwise earned — and if you DID work it, the
 * show-up check below fires first and the day still counts. Any
 * weekday with no show-up record breaks the run.
 */
const isRestDay = (d: Date) => { const g = getDay(d); return g === 0 || g === 6; };

export function computeStats(attendance: AttLike[], logs: LogLike[]): AchievementStats {
  const showUp = new Set(attendance.filter(a => SHOW_UP.has(a.status)).map(a => a.date));
  const engaged = new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)]);

  // ---- streaks ----
  let longestStreak = 0;
  let comebacks = 0;
  if (showUp.size > 0) {
    const sorted = [...showUp].sort();
    const first = parseISO(sorted[0]);
    const last = parseISO(sorted[sorted.length - 1]);
    let run = 0;
    for (const d of eachDayOfInterval({ start: first, end: last })) {
      if (showUp.has(iso(d))) { run++; longestStreak = Math.max(longestStreak, run); }
      else if (!isRestDay(d)) run = 0;
    }
    // A "comeback" = returning after a gap of 7+ days.
    for (let i = 1; i < sorted.length; i++) {
      const gap = (parseISO(sorted[i]).getTime() - parseISO(sorted[i - 1]).getTime()) / 86_400_000;
      if (gap >= 7) comebacks++;
    }
  }

  // Current streak: walk backwards from today. Today not being logged yet
  // doesn't break anything — the day isn't over.
  let currentStreak = 0;
  const now = new Date();
  let cursor = showUp.has(iso(now)) ? now : subDays(now, 1);
  for (let i = 0; i < 3650; i++) {
    const key = iso(cursor);
    if (showUp.has(key)) currentStreak++;
    else if (!isRestDay(cursor)) break;
    cursor = subDays(cursor, 1);
  }

  // ---- perfect weeks (Mon–Fri all showed up) ----
  const weekBuckets = new Map<string, Set<number>>();
  for (const date of showUp) {
    const d = parseISO(date);
    const dow = getDay(d); // 0 Sun .. 6 Sat
    if (dow === 0 || dow === 6) continue;
    // Bucket by Monday-start week (matches the digest's convention).
    const key = iso(startOfWeek(d, { weekStartsOn: 1 }));
    if (!weekBuckets.has(key)) weekBuckets.set(key, new Set());
    weekBuckets.get(key)!.add(dow);
  }
  const perfectWeeks = [...weekBuckets.values()].filter(s => s.size === 5).length;

  // ---- best calendar month ----
  const monthCounts = new Map<string, number>();
  for (const date of showUp) {
    const key = date.slice(0, 7);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const bestMonthDays = Math.max(0, ...monthCounts.values());

  const projects = new Set(
    logs.map(l => l.client_or_project?.trim()).filter((p): p is string => !!p)
  );

  return {
    daysLogged: engaged.size,
    showUpDays: showUp.size,
    currentStreak,
    longestStreak,
    totalLogs: logs.length,
    doneCount: logs.filter(l => l.status === "DONE").length,
    wfhDays: attendance.filter(a => a.status === "WFH").length,
    distinctProjects: projects.size,
    perfectWeeks,
    bestMonthDays,
    comebacks,
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: "origin_story", name: "Origin Story", iconText: "OS", tier: "bronze",
    desc: "Log your very first day. Every hero starts somewhere.",
    target: 1, value: s => s.daysLogged,
  },
  {
    code: "web_slinger", name: "Web Slinger", iconText: "WS", tier: "bronze",
    desc: "Show up 3 days in a row.",
    target: 3, value: s => s.longestStreak,
  },
  {
    code: "spectacular", name: "Spectacular", iconText: "SP", tier: "silver",
    desc: "A 7-day streak. The Bugle would run this.",
    target: 7, value: s => s.longestStreak,
  },
  {
    code: "amazing", name: "The Amazing One", iconText: "AM", tier: "gold",
    desc: "A 30-day streak. Genuinely amazing.",
    target: 30, value: s => s.longestStreak,
  },
  {
    code: "web_warrior", name: "Web Warrior", iconText: "WW", tier: "bronze",
    desc: "Log 10 work items.",
    target: 10, value: s => s.totalLogs,
  },
  {
    code: "bugle_regular", name: "Bugle Regular", iconText: "BR", tier: "silver",
    desc: "Log 50 work items. Jameson still isn't impressed.",
    target: 50, value: s => s.totalLogs,
  },
  {
    code: "centurion", name: "Centurion", iconText: "CN", tier: "gold",
    desc: "Log 100 work items.",
    target: 100, value: s => s.totalLogs,
  },
  {
    code: "task_terminator", name: "Task Terminator", iconText: "TT", tier: "silver",
    desc: "Mark 25 items as Done.",
    target: 25, value: s => s.doneCount,
  },
  {
    code: "perfect_week", name: "Perfect Week", iconText: "PW", tier: "silver",
    desc: "Show up every weekday in a single week.",
    target: 1, value: s => s.perfectWeeks,
  },
  {
    code: "remote_hero", name: "Friendly Remote Hero", iconText: "RH", tier: "bronze",
    desc: "Work from home 5 times.",
    target: 5, value: s => s.wfhDays,
  },
  {
    code: "multiverse", name: "Into the Multiverse", iconText: "IM", tier: "silver",
    desc: "Juggle 5 different projects or clients.",
    target: 5, value: s => s.distinctProjects,
  },
  {
    code: "back_in_suit", name: "Back in the Suit", iconText: "BS", tier: "bronze",
    desc: "Return after a week away. Heroes always come back.",
    target: 1, value: s => s.comebacks,
  },
  {
    code: "iron_will", name: "Iron Will", iconText: "IW", tier: "gold",
    desc: "Show up 20 days in one calendar month.",
    target: 20, value: s => s.bestMonthDays,
  },
  {
    code: "no_way_home", name: "No Way Home", iconText: "NH", tier: "legendary",
    desc: "100 days showed up. You live here now.",
    target: 100, value: s => s.showUpDays,
  },
];

export const TIER_COLOR: Record<Tier, string> = {
  bronze: "#c9974c",
  silver: "#9aa3b2",
  gold: "#ffd831",
  legendary: "#dc2626",
};

export interface EvaluatedAchievement extends AchievementDef {
  unlocked: boolean;
  current: number;
  pct: number;
}

export function evaluate(stats: AchievementStats): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map(a => {
    const current = Math.min(a.value(stats), a.target);
    return {
      ...a,
      current,
      unlocked: current >= a.target,
      pct: Math.round((current / a.target) * 100),
    };
  });
}

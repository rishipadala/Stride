// ============================================================
// Spidey Quotes Engine
// Categorized, friendly-neighborhood motivation for Stride.
// Use getQuote() in event handlers / useEffect (random is fine there).
// Use pickDeterministic() when a quote is rendered during SSR to
// avoid hydration mismatches.
// ============================================================

export type QuoteContext =
  | "morning"
  | "afternoon"
  | "evening"
  | "streak"
  | "comeback"
  | "friday"
  | "achievement"
  | "login"
  | "landing"
  | "general";

export const QUOTES: Record<QuoteContext, string[]> = {
  morning: [
    "It's a new day. Time to be extraordinary.",
    "Wake up, suit up, log up. Let's swing!",
    "The city's counting on you today. So is your streak.",
    "Great mornings come with great responsibility.",
    "Rise and thwip. Today's yours to save.",
  ],
  afternoon: [
    "Midday hustle — Spidey never quits.",
    "Keep swinging, the day's not done yet.",
    "Half the day saved. Half still to go, hero.",
    "Your spider-sense says: one more task.",
  ],
  evening: [
    "Winding down? Log the wins before you rest.",
    "Even heroes clock out. Note today's victories first.",
    "The night is young, but your streak needs feeding.",
    "One last swing before the city sleeps.",
  ],
  streak: [
    "My spider-sense is tingling... you're on fire!",
    "Unstoppable. The Daily Bugle would run this headline.",
    "That streak? Amazing. Spectacular, even.",
    "You've got the reflexes of a radioactive legend.",
    "Consistency is your superpower. Keep it up!",
  ],
  comeback: [
    "The city didn't forget you. Neither did your streak.",
    "Every hero has an off day. Welcome back, champ.",
    "Back in the suit. Let's pick up where we left off.",
    "Missed a beat? Heroes always get back up.",
  ],
  friday: [
    "Another week saved by your friendly neighborhood dev!",
    "Friday feeling: you've earned every bit of it.",
    "TGIF — Thank goodness I'm... a hero.",
    "Wrap the week like a web. Neat and complete.",
  ],
  achievement: [
    "With great power comes great responsibility... and great badges.",
    "Achievement unlocked. Aunt May would be proud.",
    "Look at you go — collecting wins like web-fluid cartridges.",
    "New badge, who dis?",
    "You didn't just show up. You showed OFF.",
  ],
  login: [
    "With great power comes great productivity!",
    "Your friendly neighborhood work tracker awaits!",
    "Anyone can wear the mask. Time to suit up!",
    "Every hero needs a log. This is yours.",
    "The city never sleeps, and neither does your hustle!",
    "Welcome back, hero. The web's been waiting.",
  ],
  landing: [
    "It's not about the mask. It's about what you do while wearing it.",
    "Everyone gets one shot at a great day. Track yours.",
    "Your work. Your web. Your win.",
    "Be your own friendly neighborhood hero.",
  ],
  general: [
    "With great power comes great productivity!",
    "Anyone can be a hero. Today, it's your turn.",
    "Keep swinging. You're doing great.",
    "Small steps, spectacular results.",
    "The suit doesn't make the hero. The habit does.",
    "Do whatever a spider can — one task at a time.",
    "Hang in there. Literally.",
  ],
};

/** Random quote — safe for client event handlers and useEffect. */
export function getQuote(context: QuoteContext = "general"): string {
  const pool = QUOTES[context] ?? QUOTES.general;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The label on the caption tab above each quote.
 *
 * Comic captions announce where you are in the story — "MEANWHILE",
 * "LATER THAT DAY", "END OF ISSUE" — so these do the same, and the
 * tab ends up carrying real information: which slice of the day or
 * which moment in the app you're looking at.
 */
export const KICKER: Record<QuoteContext, string> = {
  morning:     "Meanwhile, in Queens",
  afternoon:   "Later that day",
  evening:     "As night falls",
  streak:      "Spider-sense",
  comeback:    "Previously",
  friday:      "End of issue",
  achievement: "Thwip!",
  login:       "Meanwhile",
  landing:     "The amazing",
  general:     "Spider-sense",
};

/** Deterministic pick from a seed — SSR-safe (server & client agree). */
export function pickDeterministic(context: QuoteContext, seed: number): string {
  const pool = QUOTES[context] ?? QUOTES.general;
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx];
}

/** Time-of-day context from an hour (0–23). */
export function contextForHour(hour: number): QuoteContext {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Context for a specific moment. Friday outranks the clock — it's the
 * one weekday the app already has its own voice for. Sunday hour 0–23
 * falls through to the time of day like everything else.
 *
 * @param hour     0–23
 * @param dayIndex JS getDay(): 0 = Sunday
 */
export function contextForMoment(hour: number, dayIndex: number): QuoteContext {
  if (dayIndex === 5 && hour >= 12) return "friday";
  return contextForHour(hour);
}

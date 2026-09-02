export type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";
export type WorkLogStatus = "DONE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "TO_IMPLEMENT" | "BLOCKED";

export function statusDotClass(status: AttendanceStatus | WorkLogStatus | null): string {
  const map: Record<string, string> = {
    PRESENT: "dot-present", WFH: "dot-wfh", HALF_DAY: "dot-half-day",
    LEAVE: "dot-leave",
    DONE: "dot-done", IN_PROGRESS: "dot-in-progress",
    WAITING_ON_CLIENT: "dot-waiting", TO_IMPLEMENT: "dot-to-implement",
    BLOCKED: "dot-blocked",
  };
  return map[status ?? ""] ?? "dot-unmarked";
}

export function badgeClass(status: string): string {
  return `badge badge-${status}`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PRESENT: "Present", HALF_DAY: "Half Day", WFH: "WFH", LEAVE: "Leave",
    DONE: "Done", IN_PROGRESS: "In Progress", WAITING_ON_CLIENT: "Waiting on Client",
    TO_IMPLEMENT: "To Implement", BLOCKED: "Blocked",
  };
  return labels[status] ?? status;
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ============================================================
// Day boundaries are LOCAL, not UTC.
//
// A date column in Postgres stores a calendar day, and the day a
// person means is the one on the wall behind them. toISOString()
// converts to UTC first, so in IST (UTC+5:30) every moment before
// 05:30 local reports yesterday's date — a user marking attendance
// at 9am is fine, but one logging at 1am gets filed under the wrong
// day. Build the string from the local calendar fields instead.
// ============================================================
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Local calendar date n days before today (n may be negative). */
export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

// ============================================================
// User types — Stride isn't just for employees. Anyone with a day
// worth tracking gets a home here, including people between jobs.
// Values must stay in sync with the employment_type CHECK
// constraint (see migrations/002_v2_public_product.sql).
// ============================================================
export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME",  label: "Full-time",          note: "Daily work, logged" },
  { value: "INTERN",     label: "Intern",             note: "Learn & contribute" },
  { value: "STUDENT",    label: "Student",            note: "Track the study grind" },
  { value: "FREELANCER", label: "Freelancer",         note: "Client work, sorted" },
  { value: "SEEKING",    label: "Yet to be Employed", note: "Chasing the dream anyway" },
] as const;

export function employmentLabel(type: string | null): string {
  return EMPLOYMENT_TYPES.find(t => t.value === type)?.label ?? "Tracker";
}
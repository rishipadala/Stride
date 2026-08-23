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

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
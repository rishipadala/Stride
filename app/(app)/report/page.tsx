"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusLabel, fmtDate, toISODate } from "@/lib/utils";

const STATUS_BG: Record<string, string> = {
  PRESENT: "#bbf7d0", WFH: "#bfdbfe", HALF_DAY: "#fde68a", LEAVE: "#e9d5ff",
  DONE: "#bbf7d0", IN_PROGRESS: "#bfdbfe", WAITING_ON_CLIENT: "#fde68a",
  TO_IMPLEMENT: "#e9d5ff", BLOCKED: "#fecaca",
};
const STATUS_FG: Record<string, string> = {
  PRESENT: "#15803d", WFH: "#1d4ed8", HALF_DAY: "#92400e", LEAVE: "#7e22ce",
  DONE: "#15803d", IN_PROGRESS: "#1d4ed8", WAITING_ON_CLIENT: "#92400e",
  TO_IMPLEMENT: "#7e22ce", BLOCKED: "#dc2626",
};

type Period = "week" | "month" | "custom";
interface AttRow { date: string; status: string; notes: string | null; }
interface LogRow { id: string; date: string; task: string; client_or_project: string | null; status: string; }

function weekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function monthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6);
  return `${fmtDate(toISODate(start))} — ${fmtDate(toISODate(end))}`;
}

export default function ReportPage() {
  const supabase = createClient();
  const today = toISODate(new Date());

  const [period, setPeriod] = useState<Period>("week");
  // week/month navigation offset (0 = current)
  const [offset, setOffset] = useState(0);
  // custom date range
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return toISODate(d); });
  const [customTo, setCustomTo] = useState(today);

  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [userName, setUserName] = useState("");

  // Derive from/to from period + offset
  const { from, to, label } = (() => {
    if (period === "custom") return { from: customFrom, to: customTo, label: `${fmtDate(customFrom)} — ${fmtDate(customTo)}` };
    const now = new Date();
    if (period === "week") {
      const base = weekStart(now);
      const start = addDays(base, offset * 7);
      const end = addDays(start, 6);
      const clampedTo = toISODate(end) > today ? today : toISODate(end);
      return { from: toISODate(start), to: clampedTo, label: fmtWeekRange(start) };
    }
    // month
    const base = monthStart(now);
    const start = addMonths(base, offset);
    const end = monthEnd(start);
    const clampedTo = toISODate(end) > today ? today : toISODate(end);
    return { from: toISODate(start), to: clampedTo, label: fmtMonthYear(start) };
  })();

  async function generate() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (profile?.full_name) setUserName(profile.full_name);
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("date, status, notes").eq("user_id", user.id).gte("date", from).lte("date", to).order("date"),
      supabase.from("work_logs").select("id, date, task, client_or_project, status").eq("user_id", user.id).gte("date", from).lte("date", to).order("date").order("created_at"),
    ]);
    setAttendance(att ?? []);
    setLogs(wl ?? []);
    setSearched(true);
    setLoading(false);
  }

  // Aggregates
  const attCounts: Record<string, number> = {};
  attendance.forEach(a => { attCounts[a.status] = (attCounts[a.status] ?? 0) + 1; });
  const logCounts: Record<string, number> = {};
  logs.forEach(l => { logCounts[l.status] = (logCounts[l.status] ?? 0) + 1; });
  const totalWorked = attendance.filter(a => ["PRESENT","WFH","HALF_DAY"].includes(a.status)).length;
  const totalDone = logs.filter(l => l.status === "DONE").length;

  // Group logs by date for the timeline
  const logsByDate: Record<string, LogRow[]> = {};
  logs.forEach(l => { if (!logsByDate[l.date]) logsByDate[l.date] = []; logsByDate[l.date].push(l); });

  // All dates in range that have either attendance or logs
  const allDates = Array.from(new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)])).sort();

  function handlePrint() { window.print(); }

  const periodPrev = () => setOffset(o => o - 1);
  const periodNext = () => { if (offset < 0) setOffset(o => o + 1); };

  return (
    <>
      {/* Print styles injected here so they live alongside the component */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #stride-report, #stride-report * { visibility: visible; }
          #stride-report { position: fixed; inset: 0; background: #fff; color: #000; padding: 2rem; }
          .no-print { display: none !important; }
          .card, .card-sm { box-shadow: none !important; border: 1.5px solid #ccc !important; }
          .btn { display: none !important; }
          .stat-streak { background: #ffd831 !important; }
        }
      `}</style>

      <div id="stride-report" className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

        {/* Header */}
        <div>
          <h1 className="font-title" style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: .94 }}>My Report</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".9rem", marginTop: ".3rem" }}>Weekly, monthly, or a custom date range — then export as PDF.</p>
        </div>

        {/* Controls */}
        <div className="card-sm no-print" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Period tabs */}
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {(["week", "month", "custom"] as Period[]).map(p => (
              <button
                key={p}
                className={`btn ${period === p ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: ".4rem 1rem", fontSize: ".8rem" }}
                onClick={() => { setPeriod(p); setOffset(0); setSearched(false); }}
              >
                {p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom Range"}
              </button>
            ))}
          </div>

          {/* Navigation for week/month */}
          {period !== "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodPrev}>← Prev</button>
              <span style={{ fontSize: ".88rem", fontWeight: 600, minWidth: 200, textAlign: "center" }}>{label}</span>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodNext} disabled={offset >= 0}>Next →</button>
            </div>
          )}

          {/* Custom range pickers */}
          {period === "custom" && (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <label className="input-label">From</label>
                <input className="input" type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <label className="input-label">To</label>
                <input className="input" type="date" value={customTo} min={customFrom} max={today} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? <span className="spinner" /> : "Generate Report"}
            </button>
            {searched && (
              <button className="btn btn-ghost" onClick={handlePrint} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9 V3 H18 V9" /><rect x={6} y={13} width={12} height={8} /><path d="M6 18 H4 A1 1 0 0 1 3 17 V10 A1 1 0 0 1 4 9 H20 A1 1 0 0 1 21 10 V17 A1 1 0 0 1 20 18 H18" />
                </svg>
                Export as PDF
              </button>
            )}
          </div>
        </div>

        {searched && (
          <>
            {/* Report header — visible in PDF */}
            <div style={{ borderBottom: "2.5px solid var(--border)", paddingBottom: "1.25rem" }}>
              <div style={{ fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: ".35rem" }}>Stride Progress Report</div>
              <div className="font-title" style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: .95 }}>{userName}</div>
              <div className="font-mono" style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".3rem" }}>{label}</div>
            </div>

            {/* Summary stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: ".75rem" }}>
              <div className="stat-card stat-streak">
                <div className="stat-value">{totalWorked}</div>
                <div className="stat-label">Days Worked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{attendance.filter(a => a.status === "LEAVE").length}</div>
                <div className="stat-label">Days on Leave</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{logs.length}</div>
                <div className="stat-label">Work Log Entries</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalDone}</div>
                <div className="stat-label">Tasks Done</div>
              </div>
            </div>

            {/* Attendance breakdown */}
            {Object.keys(attCounts).length > 0 && (
              <div className="card">
                <h2 style={{ fontSize: ".92rem", fontWeight: 700, marginBottom: "1.1rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Attendance Breakdown</h2>
                <div style={{ display: "flex", gap: ".65rem", flexWrap: "wrap" }}>
                  {Object.entries(attCounts).map(([status, count]) => (
                    <div key={status} style={{ background: STATUS_BG[status] ?? "#f0f0f0", color: STATUS_FG[status] ?? "#333", border: "2px solid var(--border)", padding: ".5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                      <span className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>{count}</span>
                      <span style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginTop: ".2rem" }}>{statusLabel(status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work log breakdown */}
            {Object.keys(logCounts).length > 0 && (
              <div className="card">
                <h2 style={{ fontSize: ".92rem", fontWeight: 700, marginBottom: "1.1rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Work Items by Status</h2>
                <div style={{ display: "flex", gap: ".65rem", flexWrap: "wrap" }}>
                  {Object.entries(logCounts).map(([status, count]) => (
                    <div key={status} style={{ background: STATUS_BG[status] ?? "#f0f0f0", color: STATUS_FG[status] ?? "#333", border: "2px solid var(--border)", padding: ".5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                      <span className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>{count}</span>
                      <span style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginTop: ".2rem" }}>{statusLabel(status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily timeline */}
            {allDates.length > 0 ? (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "1.1rem 1.5rem", borderBottom: "2.5px solid var(--border)" }}>
                  <h2 style={{ fontSize: ".92rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Daily Timeline</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {allDates.map((date, i) => {
                    const att = attendance.find(a => a.date === date);
                    const dayLogs = logsByDate[date] ?? [];
                    return (
                      <div key={date} style={{ display: "flex", gap: "1rem", padding: "1rem 1.5rem", borderBottom: i < allDates.length - 1 ? "1.5px solid var(--surface-alt)" : "none", alignItems: "flex-start" }}>
                        {/* Date column */}
                        <div style={{ minWidth: 90, flexShrink: 0 }}>
                          <div className="font-mono" style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--text-muted)" }}>{fmtDate(date)}</div>
                          {att && (
                            <span style={{ display: "inline-block", marginTop: ".35rem", background: STATUS_BG[att.status] ?? "#eee", color: STATUS_FG[att.status] ?? "#333", fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: ".2rem .45rem", border: "1.5px solid var(--border)" }}>
                              {statusLabel(att.status)}
                            </span>
                          )}
                        </div>
                        {/* Logs for that day */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ".45rem" }}>
                          {dayLogs.length === 0 && att && (
                            <span style={{ fontSize: ".8rem", color: "var(--text-muted)", fontStyle: "italic" }}>{att.notes ?? "No work log entries"}</span>
                          )}
                          {dayLogs.map(log => (
                            <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: ".6rem" }}>
                              <span style={{ display: "inline-block", marginTop: ".2rem", width: 8, height: 8, flexShrink: 0, background: STATUS_BG[log.status] ?? "#ddd", border: "1.5px solid var(--border)" }} />
                              <div>
                                <span style={{ fontSize: ".85rem", fontWeight: 600 }}>{log.task}</span>
                                {log.client_or_project && <span style={{ fontSize: ".75rem", color: "var(--text-muted)", marginLeft: ".45rem" }}>{log.client_or_project}</span>}
                                <span style={{ display: "inline-block", marginLeft: ".45rem", fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", background: STATUS_BG[log.status] ?? "#eee", color: STATUS_FG[log.status] ?? "#333", padding: ".1rem .35rem", border: "1.5px solid var(--border)" }}>
                                  {statusLabel(log.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">No data found for this period.</div>
              </div>
            )}

            {/* PDF footer (print only) */}
            <div style={{ display: "none" }} className="print-footer">
              <hr style={{ border: "1px solid #ccc", margin: "1.5rem 0 .75rem" }} />
              <div style={{ fontSize: ".72rem", color: "#888" }}>Generated by Stride · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          .print-footer { display: block !important; }
        }
      `}</style>
    </>
  );
}

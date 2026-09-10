"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusLabel, fmtDate, toISODate, employmentLabel } from "@/lib/utils";

/* On-screen chips keep the app's pastel plates. */
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

/* ============================================================
   THE DOCUMENT IS NOT THE PAGE.
   The printed report is a separate DOM tree from the on-screen
   one. Printing the app's own markup means printing its
   furniture: 2.5px ink borders, hard drop shadows, pastel
   plates, uppercase display type. That reads as a screenshot of
   a website, not as a report someone would attach to an email.
   So the screen keeps the app's voice, and .pdf-doc gets a
   document voice — hairlines, a serif masthead, real tables
   with repeating headers, and figures that align on their
   decimal. Only one of the two is ever visible at a time.
   ============================================================ */

/* Print inks: deep enough to stay legible on paper and in
   greyscale, unlike the on-screen pastels which wash out. */
const INK: Record<string, string> = {
  PRESENT: "#1b5e20", WFH: "#0d47a1", HALF_DAY: "#e65100", LEAVE: "#4a148c",
  DONE: "#1b5e20", IN_PROGRESS: "#0d47a1", WAITING_ON_CLIENT: "#e65100",
  TO_IMPLEMENT: "#4a148c", BLOCKED: "#b71c1c",
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
  return `${fmtDate(toISODate(start))} — ${fmtDate(toISODate(addDays(start, 6)))}`;
}
/** "Mon, 13 Aug" — compact enough for a table's first column. */
function fmtDocDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
  });
}
function pct(n: number, d: number): number { return d ? Math.round((n / d) * 100) : 0; }

export default function ReportPage() {
  const supabase = createClient();
  const today = toISODate(new Date());

  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return toISODate(d); });
  const [customTo, setCustomTo] = useState(today);

  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [me, setMe] = useState<{ name: string; type: string | null; email: string }>({ name: "", type: null, email: "" });
  // Stamped when the report is built, not during render — reading the
  // clock in the render path hands the server and the browser two
  // different strings to hydrate.
  const [generatedAt, setGeneratedAt] = useState("");

  const { from, to, label } = (() => {
    if (period === "custom") return { from: customFrom, to: customTo, label: `${fmtDate(customFrom)} — ${fmtDate(customTo)}` };
    const now = new Date();
    if (period === "week") {
      const start = addDays(weekStart(now), offset * 7);
      const end = toISODate(addDays(start, 6));
      return { from: toISODate(start), to: end > today ? today : end, label: fmtWeekRange(start) };
    }
    const start = addMonths(monthStart(now), offset);
    const end = toISODate(monthEnd(start));
    return { from: toISODate(start), to: end > today ? today : end, label: fmtMonthYear(start) };
  })();

  const periodTypeLabel = period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Custom range";

  async function generate() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase
      .from("profiles").select("full_name, employment_type, email").eq("id", user.id).single();
    setMe({
      name: profile?.full_name ?? "",
      type: profile?.employment_type ?? null,
      email: profile?.email ?? user.email ?? "",
    });
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("date, status, notes").eq("user_id", user.id).gte("date", from).lte("date", to).order("date"),
      supabase.from("work_logs").select("id, date, task, client_or_project, status").eq("user_id", user.id).gte("date", from).lte("date", to).order("date").order("created_at"),
    ]);
    setAttendance(att ?? []);
    setLogs(wl ?? []);
    setGeneratedAt(new Date().toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }));
    setSearched(true);
    setLoading(false);
  }

  /* ---------- aggregates ---------- */
  const attCounts: Record<string, number> = {};
  attendance.forEach(a => { attCounts[a.status] = (attCounts[a.status] ?? 0) + 1; });
  const logCounts: Record<string, number> = {};
  logs.forEach(l => { logCounts[l.status] = (logCounts[l.status] ?? 0) + 1; });

  const totalWorked = attendance.filter(a => ["PRESENT", "WFH", "HALF_DAY"].includes(a.status)).length;
  const totalLeave = attendance.filter(a => a.status === "LEAVE").length;
  const totalDone = logs.filter(l => l.status === "DONE").length;
  const completion = pct(totalDone, logs.length);
  const calendarDays = Math.round(
    (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000
  ) + 1;

  const logsByDate: Record<string, LogRow[]> = {};
  logs.forEach(l => { (logsByDate[l.date] ||= []).push(l); });
  const allDates = Array.from(new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)])).sort();
  const attByDate = new Map(attendance.map(a => [a.date, a]));

  const projects = (() => {
    const m = new Map<string, { items: number; done: number }>();
    logs.forEach(l => {
      const key = l.client_or_project?.trim() || "Unassigned";
      const cur = m.get(key) ?? { items: 0, done: 0 };
      cur.items++;
      if (l.status === "DONE") cur.done++;
      m.set(key, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].items - a[1].items);
  })();

  const periodPrev = () => setOffset(o => o - 1);
  const periodNext = () => { if (offset < 0) setOffset(o => o + 1); };

  /** One distribution row: label, count, share, and a proportion rule. */
  function DistRow({ status, count, total }: { status: string; count: number; total: number }) {
    const share = pct(count, total);
    return (
      <tr>
        <td className="pd-t-label">
          <span className="pd-swatch" style={{ background: INK[status] ?? "#444" }} />
          {statusLabel(status)}
        </td>
        <td className="pd-num">{count}</td>
        <td className="pd-num pd-muted">{share}%</td>
        <td className="pd-barcell">
          <span className="pd-bar"><i style={{ width: `${share}%`, background: INK[status] ?? "#444" }} /></span>
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* ================= PRINT DOCUMENT =================
          Hidden on screen, and the only thing visible on paper. */}
      {searched && (
        <div className="pdf-doc" aria-hidden="true">
          {/* Masthead */}
          <header className="pd-masthead">
            <span className="pd-brand">Stride</span>
            <span className="pd-doctype">Work Progress Report</span>
          </header>

          {/* Title block */}
          <div className="pd-title-block">
            <h1 className="pd-name">{me.name}</h1>
            <p className="pd-ident">
              {employmentLabel(me.type)}{me.email ? ` · ${me.email}` : ""}
            </p>
          </div>

          <dl className="pd-meta">
            <div><dt>Reporting period</dt><dd>{label}</dd></div>
            <div><dt>Report type</dt><dd>{periodTypeLabel}</dd></div>
            <div><dt>Calendar days</dt><dd>{calendarDays}</dd></div>
            <div><dt>Generated</dt><dd>{generatedAt}</dd></div>
          </dl>

          {/* Headline figures */}
          <section className="pd-section">
            <h2 className="pd-h2">Summary</h2>
            <div className="pd-figures">
              <div className="pd-fig"><span className="pd-fig-n">{totalWorked}</span><span className="pd-fig-l">Days worked</span></div>
              <div className="pd-fig"><span className="pd-fig-n">{totalLeave}</span><span className="pd-fig-l">Days on leave</span></div>
              <div className="pd-fig"><span className="pd-fig-n">{logs.length}</span><span className="pd-fig-l">Work items</span></div>
              <div className="pd-fig"><span className="pd-fig-n">{totalDone}</span><span className="pd-fig-l">Completed</span></div>
              <div className="pd-fig"><span className="pd-fig-n">{completion}%</span><span className="pd-fig-l">Completion</span></div>
            </div>
          </section>

          {/* Attendance distribution */}
          {Object.keys(attCounts).length > 0 && (
            <section className="pd-section">
              <h2 className="pd-h2">Attendance</h2>
              <table className="pd-table">
                <thead>
                  <tr><th>Status</th><th className="pd-num">Days</th><th className="pd-num">Share</th><th className="pd-barhead">Distribution</th></tr>
                </thead>
                <tbody>
                  {Object.entries(attCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, c]) => <DistRow key={s} status={s} count={c} total={attendance.length} />)}
                </tbody>
                <tfoot>
                  <tr><td>Total recorded</td><td className="pd-num">{attendance.length}</td><td className="pd-num">100%</td><td /></tr>
                </tfoot>
              </table>
            </section>
          )}

          {/* Work output distribution */}
          {Object.keys(logCounts).length > 0 && (
            <section className="pd-section">
              <h2 className="pd-h2">Work output</h2>
              <table className="pd-table">
                <thead>
                  <tr><th>Status</th><th className="pd-num">Items</th><th className="pd-num">Share</th><th className="pd-barhead">Distribution</th></tr>
                </thead>
                <tbody>
                  {Object.entries(logCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, c]) => <DistRow key={s} status={s} count={c} total={logs.length} />)}
                </tbody>
                <tfoot>
                  <tr><td>Total logged</td><td className="pd-num">{logs.length}</td><td className="pd-num">100%</td><td /></tr>
                </tfoot>
              </table>
            </section>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <section className="pd-section">
              <h2 className="pd-h2">Projects &amp; clients</h2>
              <table className="pd-table">
                <thead>
                  <tr><th>Project / Client</th><th className="pd-num">Items</th><th className="pd-num">Completed</th><th className="pd-num">Rate</th></tr>
                </thead>
                <tbody>
                  {projects.map(([name, v]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="pd-num">{v.items}</td>
                      <td className="pd-num">{v.done}</td>
                      <td className="pd-num pd-muted">{pct(v.done, v.items)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Daily record — the body of the document */}
          <section className="pd-section">
            <h2 className="pd-h2">Daily record</h2>
            {allDates.length === 0 ? (
              <p className="pd-empty">No activity was recorded in this period.</p>
            ) : (
              <table className="pd-table pd-log">
                <thead>
                  <tr>
                    <th style={{ width: "16%" }}>Date</th>
                    <th style={{ width: "14%" }}>Attendance</th>
                    <th>Task</th>
                    <th style={{ width: "18%" }}>Project</th>
                    <th style={{ width: "13%" }}>Status</th>
                  </tr>
                </thead>
                {allDates.map(date => {
                  const att = attByDate.get(date);
                  const tasks = logsByDate[date] ?? [];
                  const span = Math.max(1, tasks.length);
                  return (
                    <tbody key={date} className="pd-day">
                      {(tasks.length ? tasks : [null]).map((log, i) => (
                        <tr key={log?.id ?? "none"}>
                          {i === 0 && (
                            <>
                              <td rowSpan={span} className="pd-date">{fmtDocDate(date)}</td>
                              <td rowSpan={span} className="pd-att">
                                {att ? statusLabel(att.status) : "—"}
                                {att?.notes && <em className="pd-note">{att.notes}</em>}
                              </td>
                            </>
                          )}
                          {log ? (
                            <>
                              <td>{log.task}</td>
                              <td className="pd-muted">{log.client_or_project || "—"}</td>
                              <td>
                                <span className="pd-status" style={{ color: INK[log.status] ?? "#444" }}>
                                  {statusLabel(log.status)}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={3} className="pd-muted pd-none">No work items logged</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
              </table>
            )}
          </section>

          <footer className="pd-footer">
            <span>{me.name} · {label}</span>
            <span>Generated by Stride · {generatedAt}</span>
          </footer>
        </div>
      )}

      {/* ================= ON-SCREEN VIEW ================= */}
      <div className="screen-only animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div>
          <h1 className="font-title" style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: .94 }}>My Report</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".9rem", marginTop: ".3rem" }}>Weekly, monthly, or a custom date range — then export as PDF.</p>
        </div>

        {/* Controls */}
        <div className="card-sm" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

          {period !== "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodPrev}>← Prev</button>
              <span style={{ fontSize: ".88rem", fontWeight: 600, minWidth: 200, textAlign: "center" }}>{label}</span>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodNext} disabled={offset >= 0}>Next →</button>
            </div>
          )}

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
              <button className="btn btn-ghost" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9 V3 H18 V9" /><rect x={6} y={13} width={12} height={8} /><path d="M6 18 H4 A1 1 0 0 1 3 17 V10 A1 1 0 0 1 4 9 H20 A1 1 0 0 1 21 10 V17 A1 1 0 0 1 20 18 H18" />
                </svg>
                Export as PDF
              </button>
            )}
          </div>

          {searched && (
            <p style={{ fontSize: ".74rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              The PDF is typeset as a document, not a copy of this screen. In the print dialog choose
              <strong> Save as PDF</strong>, and switch <strong>Headers and footers</strong> off for a clean page.
            </p>
          )}
        </div>

        {searched && (
          <>
            <div style={{ borderBottom: "2.5px solid var(--border)", paddingBottom: "1.25rem" }}>
              <div style={{ fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: ".35rem" }}>Preview</div>
              <div className="font-title" style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: .95 }}>{me.name}</div>
              <div className="font-mono" style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".3rem" }}>{label}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: ".75rem" }}>
              <div className="stat-card stat-streak">
                <div className="stat-value">{totalWorked}</div>
                <div className="stat-label">Days Worked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalLeave}</div>
                <div className="stat-label">Days on Leave</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{logs.length}</div>
                <div className="stat-label">Work Items</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalDone}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>

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

            {allDates.length > 0 ? (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "1.1rem 1.5rem", borderBottom: "2.5px solid var(--border)" }}>
                  <h2 style={{ fontSize: ".92rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Daily Record</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {allDates.map((date, i) => {
                    const att = attByDate.get(date);
                    const dayLogs = logsByDate[date] ?? [];
                    return (
                      <div key={date} style={{ display: "flex", gap: "1rem", padding: "1rem 1.5rem", borderBottom: i < allDates.length - 1 ? "1.5px solid var(--surface-alt)" : "none", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 90, flexShrink: 0 }}>
                          <div className="font-mono" style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--text-muted)" }}>{fmtDate(date)}</div>
                          {att && (
                            <span style={{ display: "inline-block", marginTop: ".35rem", background: STATUS_BG[att.status] ?? "#eee", color: STATUS_FG[att.status] ?? "#333", fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: ".2rem .45rem", border: "1.5px solid var(--border)" }}>
                              {statusLabel(att.status)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ".45rem" }}>
                          {dayLogs.length === 0 && att && (
                            <span style={{ fontSize: ".8rem", color: "var(--text-muted)", fontStyle: "italic" }}>{att.notes ?? "No work items logged"}</span>
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
              <div className="card"><div className="empty-state">No data found for this period.</div></div>
            )}
          </>
        )}
      </div>

      <style>{`
        /* The document never shows on screen. */
        .pdf-doc { display: none; }

        @media print {
          @page { size: A4; margin: 15mm 14mm 14mm; }

          /* Everything the app draws goes away: sidebar, mobile bar,
             and the whole interactive view. */
          .sidebar, .mobile-header, .screen-only { display: none !important; }

          /* AppShell centres main in a 900px column with inline
             styles, which only !important can beat. */
          main { margin-left: 0 !important; padding: 0 !important; }
          main > div { max-width: none !important; margin: 0 !important; }
          html, body { background: #fff !important; }

          .pdf-doc {
            display: block !important;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #16181d;
            font-size: 9.6pt;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pdf-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ---- masthead ---- */
          .pd-masthead {
            display: flex; align-items: baseline; justify-content: space-between;
            border-bottom: 1.5pt solid #16181d;
            padding-bottom: 5pt;
          }
          .pd-brand {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 15pt; font-weight: 700; letter-spacing: .02em;
          }
          .pd-doctype {
            font-size: 7.5pt; font-weight: 600;
            letter-spacing: .18em; text-transform: uppercase; color: #55606e;
          }

          /* ---- title ---- */
          .pd-title-block { margin-top: 16pt; }
          .pd-name {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 23pt; font-weight: 400; line-height: 1.1;
            margin: 0; letter-spacing: -.01em;
          }
          .pd-ident { margin: 3pt 0 0; font-size: 9pt; color: #55606e; }

          /* ---- meta grid ---- */
          .pd-meta {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 0; margin: 14pt 0 0; padding: 9pt 0;
            border-top: .5pt solid #c8cdd6; border-bottom: .5pt solid #c8cdd6;
          }
          .pd-meta > div { padding-right: 10pt; }
          .pd-meta dt {
            font-size: 6.8pt; font-weight: 700; letter-spacing: .13em;
            text-transform: uppercase; color: #7b8494; margin-bottom: 2pt;
          }
          .pd-meta dd { margin: 0; font-size: 9pt; font-weight: 500; }

          /* ---- sections ---- */
          .pd-section { margin-top: 20pt; break-inside: avoid; page-break-inside: avoid; }
          .pd-h2 {
            font-size: 7.6pt; font-weight: 700; letter-spacing: .15em;
            text-transform: uppercase; color: #16181d;
            margin: 0 0 7pt; padding-bottom: 3pt;
            border-bottom: .5pt solid #16181d;
          }

          /* ---- headline figures ---- */
          .pd-figures { display: flex; }
          .pd-fig {
            flex: 1; padding: 4pt 8pt 2pt;
            border-left: .5pt solid #dfe3e9;
          }
          .pd-fig:first-child { border-left: 0; padding-left: 0; }
          .pd-fig-n {
            display: block;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 19pt; line-height: 1; font-weight: 400;
            font-variant-numeric: tabular-nums;
          }
          .pd-fig-l {
            display: block; margin-top: 3pt;
            font-size: 6.8pt; font-weight: 600; letter-spacing: .1em;
            text-transform: uppercase; color: #7b8494;
          }

          /* ---- tables ---- */
          .pd-table { width: 100%; border-collapse: collapse; }
          .pd-table th {
            font-size: 6.8pt; font-weight: 700; letter-spacing: .11em;
            text-transform: uppercase; color: #7b8494;
            text-align: left; padding: 0 6pt 4pt 0;
            border-bottom: .5pt solid #c8cdd6;
          }
          .pd-table td {
            padding: 4.5pt 6pt 4.5pt 0;
            border-bottom: .5pt solid #eceef2;
            vertical-align: top;
          }
          .pd-table tfoot td {
            border-top: .75pt solid #16181d; border-bottom: 0;
            font-weight: 700; padding-top: 5pt;
          }
          .pd-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
          .pd-muted { color: #7b8494; }
          .pd-t-label { white-space: nowrap; }

          /* status swatch + proportion rule */
          .pd-swatch {
            display: inline-block; width: 6pt; height: 6pt;
            margin-right: 5pt; vertical-align: baseline;
          }
          .pd-barhead { width: 34%; }
          .pd-barcell { padding-right: 0 !important; }
          .pd-bar {
            display: block; width: 100%; height: 4.5pt;
            background: #eceef2; margin-top: 2.5pt;
          }
          .pd-bar > i { display: block; height: 100%; }

          /* ---- daily record ---- */
          .pd-log { margin-top: 2pt; }
          /* Header repeats on every page the table spills onto. */
          .pd-log thead { display: table-header-group; }
          .pd-day { break-inside: avoid; page-break-inside: avoid; }
          .pd-day td { border-bottom: .5pt solid #eceef2; }
          .pd-date {
            font-weight: 600; white-space: nowrap;
            border-right: .5pt solid #eceef2;
          }
          .pd-att { font-size: 8.6pt; border-right: .5pt solid #eceef2; }
          .pd-note {
            display: block; margin-top: 2pt;
            font-size: 7.6pt; color: #7b8494; font-style: italic;
          }
          .pd-status {
            font-size: 7.4pt; font-weight: 700;
            letter-spacing: .07em; text-transform: uppercase;
          }
          .pd-none { font-style: italic; }
          .pd-empty { font-size: 9pt; color: #7b8494; font-style: italic; margin: 0; }

          /* ---- footer ---- */
          .pd-footer {
            display: flex; justify-content: space-between;
            margin-top: 22pt; padding-top: 6pt;
            border-top: .5pt solid #c8cdd6;
            font-size: 7.2pt; color: #7b8494;
          }
        }
      `}</style>
    </>
  );
}

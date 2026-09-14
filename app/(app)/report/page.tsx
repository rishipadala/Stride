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
  // The inline proportion bar that used to ride in a fourth column is
  // gone. It restated the Share % beside it, and at 34% of the table
  // width it squeezed the three columns that carried the actual
  // numbers — which is what made this table read as congested.
  function DistRow({ status, count, total }: { status: string; count: number; total: number }) {
    return (
      <tr>
        <td className="pd-t-label">
          <span className="pd-swatch" style={{ background: INK[status] ?? "#444" }} />
          {statusLabel(status)}
        </td>
        <td className="pd-num">{count}</td>
        <td className="pd-num">{pct(count, total)}%</td>
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


          {/* Projects */}
          {projects.length > 0 && (
            <section className="pd-section">
              <h2 className="pd-h2">Projects &amp; clients</h2>
              <table className="pd-table">
                <colgroup>
                  <col style={{ width: "46%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr><th className="pd-th-l">Project / Client</th><th>Items</th><th>Completed</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {projects.map(([name, v]) => (
                    <tr key={name}>
                      <td className="pd-t-name">{name}</td>
                      <td className="pd-num">{v.items}</td>
                      <td className="pd-num">{v.done}</td>
                      <td className="pd-num">{pct(v.done, v.items)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Daily record — the body of the document.
              The date and attendance used to be rowSpan cells beside the
              tasks. A day with a long note stretched that first row while
              the task rows stayed short, so every column below it slid out
              of step and the statuses drifted away from their tasks. Each
              day is a banded header row instead: the tasks below it are
              plain rows, so all four columns line up straight down the
              whole document, and the note gets the full page width. */}
          <section className="pd-section pd-section-flow">
            <h2 className="pd-h2">Daily record</h2>
            {allDates.length === 0 ? (
              <p className="pd-empty">No activity was recorded in this period.</p>
            ) : (
              <table className="pd-table pd-log">
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "47%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "22%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th className="pd-th-l">Task</th>
                    <th>Project / Client</th>
                    <th>Status</th>
                  </tr>
                </thead>
                {allDates.map((date, dateIdx) => {
                  const att = attByDate.get(date);
                  const tasks = logsByDate[date] ?? [];
                  return (
                    <tbody key={date} className="pd-day">
                      {/* Spacer row between days */}
                      {dateIdx > 0 && (
                        <tr className="pd-day-spacer"><td colSpan={4} /></tr>
                      )}
                      <tr className="pd-dayrow">
                        <td colSpan={4} className="pd-dayhead">
                          <span className="pd-day-date">{fmtDocDate(date)}</span>
                          <span className="pd-day-att">
                            {att ? statusLabel(att.status) : "Not recorded"}
                          </span>
                        </td>
                      </tr>
                      {att?.notes && (
                        <tr>
                          <td colSpan={4} className="pd-noterow">
                            <span className="pd-note-label">Note</span>
                            <span className="pd-note">{att.notes}</span>
                          </td>
                        </tr>
                      )}
                      {tasks.length ? tasks.map((log, i) => (
                        <tr key={log.id}>
                          <td className="pd-idx">{i + 1}</td>
                          <td className="pd-task">{log.task}</td>
                          <td>{log.client_or_project || "—"}</td>
                          <td>
                            <span className="pd-status" style={{ color: INK[log.status] ?? "#444" }}>
                              {statusLabel(log.status)}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="pd-none">No work items logged</td></tr>
                      )}
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
      <div className="screen-only stagger" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div>
          <h1 className="font-title page-title">My Report</h1>
          <p className="page-sub" style={{ marginTop: ".3rem" }}>Weekly, monthly, or a custom date range — then export as PDF.</p>
        </div>

        {/* Controls */}
        <div className="card-sm" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="btn-row-stack" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodPrev}>← Prev</button>
              <span style={{ fontSize: ".88rem", fontWeight: 600, minWidth: 0, flex: "1 1 140px", textAlign: "center" }}>{label}</span>
              <button className="btn btn-ghost" style={{ padding: ".35rem .75rem", fontSize: ".8rem" }} onClick={periodNext} disabled={offset >= 0}>Next →</button>
            </div>
          )}

          {period === "custom" && (
            <div className="history-filters" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
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
                      <div key={date} className="rp-day" style={{ display: "flex", gap: "1rem", padding: "1rem 1.5rem", borderBottom: i < allDates.length - 1 ? "1.5px solid var(--surface-alt)" : "none", alignItems: "flex-start" }}>
                        <div className="rp-day-meta" style={{ minWidth: 90, flexShrink: 0 }}>
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
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&display=swap');

        /* The document never shows on screen. */
        .pdf-doc { display: none; }

        /* Daily Record rows put the date in a fixed 90px column beside
           the tasks. On a 360px phone that column plus the gap plus
           1.5rem of side padding leaves barely 20 characters for the
           task itself, so past this point the date sits above its items
           as a heading instead of beside them. */
        @media (max-width: 520px) {
          .rp-day { flex-direction: column; gap: .55rem !important; padding: .9rem 1rem !important; }
          .rp-day-meta {
            min-width: 0 !important; display: flex; align-items: center;
            flex-wrap: wrap; gap: .5rem;
          }
          .rp-day-meta > span { margin-top: 0 !important; }
        }

        @media print {
          @page { size: A4; margin: 18mm 16mm 16mm; }

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
            color: #1a1e28;
            font-size: 10pt;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pdf-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ---- masthead ---- */
          .pd-masthead {
            display: flex; align-items: center; justify-content: space-between;
            padding-bottom: 8pt;
            border-bottom: 2pt solid #1a1e28;
            margin-bottom: 2pt;
          }
          .pd-brand {
            font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
            font-size: 19pt; font-weight: 900; letter-spacing: .05em;
            text-transform: uppercase; color: #1a1e28;
          }
          .pd-doctype {
            font-size: 7pt; font-weight: 700;
            letter-spacing: .22em; text-transform: uppercase; color: #6b7381;
          }

          /* ---- title block ---- */
          .pd-title-block { margin-top: 20pt; }
          .pd-name {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 26pt; font-weight: 400; line-height: 1.05;
            margin: 0; letter-spacing: -.02em; color: #1a1e28;
          }
          .pd-ident { margin: 5pt 0 0; font-size: 9.5pt; color: #6b7381; line-height: 1.4; }

          /* ---- meta grid ---- */
          .pd-meta {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 0; margin: 18pt 0 0; padding: 11pt 0;
            border-top: .75pt solid #c8cdd6; border-bottom: .75pt solid #c8cdd6;
          }
          .pd-meta > div { padding-right: 12pt; }
          .pd-meta dt {
            font-size: 6.5pt; font-weight: 700; letter-spacing: .15em;
            text-transform: uppercase; color: #8a919e; margin-bottom: 3pt;
          }
          .pd-meta dd { margin: 0; font-size: 9.5pt; font-weight: 600; color: #1a1e28; }

          /* ---- sections ---- */
          .pd-section { margin-top: 26pt; break-inside: avoid; page-break-inside: avoid; }
          .pd-section-flow { break-inside: auto; page-break-inside: auto; }
          .pd-h2 {
            font-size: 6.8pt; font-weight: 800; letter-spacing: .2em;
            text-transform: uppercase; color: #6b7381;
            margin: 0 0 10pt; padding-bottom: 4pt;
            border-bottom: 1pt solid #d0d4dc;
          }

          /* ---- headline figures ---- */
          .pd-figures { display: flex; gap: 0; margin-bottom: 2pt; }
          .pd-fig {
            flex: 1; padding: 8pt 12pt 6pt;
            border-left: 1pt solid #e0e3ea;
          }
          .pd-fig:first-child { border-left: 0; padding-left: 0; }
          .pd-fig-n {
            display: block;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 24pt; line-height: 1; font-weight: 400;
            font-variant-numeric: tabular-nums; color: #1a1e28;
          }
          .pd-fig-l {
            display: block; margin-top: 4pt;
            font-size: 6.5pt; font-weight: 700; letter-spacing: .12em;
            text-transform: uppercase; color: #8a919e;
          }

          /* ---- tables ---- */
          .pd-table {
            width: 100%; border-collapse: collapse; table-layout: fixed;
            border: 1pt solid #3f4759;
          }
          .pd-table th {
            font-size: 6.5pt; font-weight: 800; letter-spacing: .13em;
            text-transform: uppercase; color: #2a3040;
            background: #dde1ea;
            text-align: center; vertical-align: middle;
            padding: 7pt 10pt;
            border: 1pt solid #3f4759;
          }
          .pd-table td {
            padding: 8pt 10pt; border: .75pt solid #9aa0b0;
            text-align: center; vertical-align: middle;
            overflow-wrap: break-word; line-height: 1.45;
          }
          /* Zebra striping for body rows */
          .pd-table tbody tr:nth-child(even) td:not(.pd-dayhead):not(.pd-noterow):not(.pd-none) {
            background: #f4f5f9;
          }
          .pd-th-l, .pd-t-label, .pd-t-name, .pd-task { text-align: left; }
          .pd-table tfoot td {
            border-top: 1.5pt solid #1a1e28;
            background: #e8eaef; font-weight: 700;
          }
          .pd-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
          .pd-muted { color: #8a919e; }
          .pd-t-label { white-space: nowrap; }

          .pd-swatch {
            display: inline-block; width: 7pt; height: 7pt;
            margin-right: 6pt; vertical-align: middle;
            border-radius: 1pt;
            border: .25pt solid rgba(0, 0, 0, .2);
          }

          /* ---- daily record ---- */
          .pd-log { margin-top: 2pt; }
          .pd-log thead { display: table-header-group; }
          .pd-day { break-inside: avoid; page-break-inside: avoid; }

          /* Day header band */
          .pd-table td.pd-dayhead {
            text-align: left; background: #cdd3e0;
            padding: 7pt 10pt;
            border-top: 1.5pt solid #3f4759;
            border-bottom: 1pt solid #3f4759;
          }
          .pd-day-date { font-weight: 800; font-size: 10pt; color: #1a1e28; }
          .pd-day-att {
            font-size: 7.5pt; font-weight: 700; letter-spacing: .08em;
            text-transform: uppercase; color: #3a4252;
          }
          .pd-day-att::before {
            content: "\\2022"; margin: 0 6pt;
            color: #7b8494; font-weight: 400; letter-spacing: 0;
          }
          .pd-idx { color: #6b7381; font-variant-numeric: tabular-nums; font-weight: 600; }

          /* Note row — clean left-border treatment, visually separate from task rows */
          .pd-table td.pd-noterow {
            text-align: left;
            background: #f8f9fb;
            border-left: 3pt solid #8a919e;
            border-right: .75pt solid #9aa0b0;
            border-top: none;
            border-bottom: .75pt solid #c8cdd6;
            padding: 7pt 12pt 7pt 14pt;
          }
          .pd-note-label {
            display: inline;
            font-size: 7pt; font-weight: 800; font-style: italic;
            letter-spacing: .08em;
            text-transform: uppercase; color: #6b7381;
            margin-right: 6pt;
          }
          .pd-note-label::after { content: " —"; }
          .pd-note {
            font-size: 9.5pt; font-weight: 400; color: #3b424f;
            font-style: italic; line-height: 1.6;
          }

          /* Spacer between days */
          .pd-day-spacer td {
            border: none !important;
            background: transparent !important;
            padding: 0; height: 7pt;
          }

          .pd-status {
            display: inline-block;
            font-size: 7.5pt; font-weight: 700; line-height: 1.4;
            letter-spacing: .05em; text-transform: uppercase;
          }
          .pd-none { color: #8a919e; font-style: italic; font-size: 9pt; }
          .pd-empty { font-size: 9.5pt; color: #8a919e; margin: 0; }

          /* ---- footer ---- */
          .pd-footer {
            display: flex; justify-content: space-between;
            margin-top: 28pt; padding-top: 7pt;
            border-top: .75pt solid #c8cdd6;
            font-size: 7pt; color: #8a919e; letter-spacing: .03em;
          }
        }
      `}</style>
    </>
  );
}

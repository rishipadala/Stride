"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusDotClass, statusLabel, fmtDate } from "@/lib/utils";


const STATUS_COLORS: Record<string, string> = {
  DONE: "#6fae7f", IN_PROGRESS: "#5b9bd5", WAITING_ON_CLIENT: "#c9974c",
  TO_IMPLEMENT: "#9b8fd4", BLOCKED: "#c96b6b",
  PRESENT: "#6fae7f", WFH: "#5b9bd5", HALF_DAY: "#c9974c", LEAVE: "#9b8fd4",
};

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";

interface AttRow { user_id: string; date: string; status: AttendanceStatus; }
interface LogRow { user_id: string; date: string; status: string; }
interface EmpRow { id: string; full_name: string; employment_type: string | null; }

export default function ReportPage() {
  const supabase = createClient();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [searched, setSearched] = useState(false);

  async function search() {
    setLoading(true);
    const { data: emps } = await supabase.from("profiles").select("id, full_name, employment_type").order("full_name");
    const empIds = (emps ?? []).map(e => e.id);
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("user_id, date, status").in("user_id", empIds).gte("date", from).lte("date", to),
      supabase.from("work_logs").select("user_id, date, status").in("user_id", empIds).gte("date", from).lte("date", to),
    ]);
    setEmployees(emps ?? []); setAttendance(att ?? []); setLogs(wl ?? []);
    setSearched(true); setLoading(false);
  }

  // Aggregate stats
  const attCounts = attendance.reduce((acc: Record<string, number>, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});
  const logCounts = logs.reduce((acc: Record<string, number>, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {});
  const attChart = Object.entries(attCounts).map(([status, count]) => ({ status, label: statusLabel(status), count }));
  const logChart = Object.entries(logCounts).map(([status, count]) => ({ status, label: statusLabel(status), count }));

  // Per-employee summary
  const empSummary = employees.map(emp => {
    const empAtt = attendance.filter(a => a.user_id === emp.id);
    const empLog = logs.filter(l => l.user_id === emp.id);
    return { ...emp, present: empAtt.filter(a => ["PRESENT","WFH","HALF_DAY"].includes(a.status)).length, totalLogs: empLog.length };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <h1 className="font-title" style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: .94 }}>Team Report</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>Aggregate stats across the entire team</p>
      </div>

      <div className="card-sm" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="input-label">From</label>
          <input id="rep-from" className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="input-label">To</label>
          <input id="rep-to" className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button id="rep-search" className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? <span className="spinner" /> : "Generate Report"}
        </button>
      </div>

      {searched && (
        <>
          {/* Attendance Breakdown */}
          {attChart.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, marginBottom: "1.25rem" }}>Team Attendance Breakdown</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: "1rem" }}>
                {attChart.map(e => (
                  <div key={e.status} style={{ borderLeft: `3px solid ${STATUS_COLORS[e.status] ?? "#8b92a3"}`, paddingLeft: ".75rem" }}>
                    <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1 }}>{e.count}</div>
                    <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginTop: ".25rem" }}>
                      {e.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work log breakdown */}
          {logChart.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, marginBottom: "1.25rem" }}>Team Work Items by Status</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: "1rem" }}>
                {logChart.map(e => (
                  <div key={e.status} style={{ borderLeft: `3px solid ${STATUS_COLORS[e.status] ?? "#8b92a3"}`, paddingLeft: ".75rem" }}>
                    <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1 }}>{e.count}</div>
                    <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginTop: ".25rem" }}>
                      {e.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-employee table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "2.5px solid var(--border)" }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600 }}>Per-Employee Summary</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Type</th><th>Days Present/WFH</th><th>Work Log Entries</th><th></th></tr></thead>
                <tbody>
                  {empSummary.map(emp => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 500 }}>{emp.full_name}</td>
                      <td style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>{emp.employment_type === "INTERN" ? "Intern" : "Full-time"}</td>
                      <td><span className="font-mono" style={{ color: "var(--present)" }}>{emp.present}</span></td>
                      <td><span className="font-mono">{emp.totalLogs}</span></td>
                      <td><a href={`/admin/employees/${emp.id}`} className="btn btn-ghost" style={{ fontSize: ".78rem", padding: ".3rem .7rem" }}>Details →</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusDotClass, badgeClass, statusLabel, fmtDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";
type WorkLogStatus = "DONE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "TO_IMPLEMENT" | "BLOCKED";

const STATUS_COLORS: Record<string, string> = {
  DONE: "#6fae7f", IN_PROGRESS: "#5b9bd5", WAITING_ON_CLIENT: "#c9974c",
  TO_IMPLEMENT: "#9b8fd4", BLOCKED: "#c96b6b",
};

interface AttRow { date: string; status: AttendanceStatus; notes: string | null; }
interface LogRow { id: string; date: string; task: string; client_or_project: string | null; status: WorkLogStatus; }

interface Props { userId?: string; employeeName?: string; }

export default function HistoryView({ userId, employeeName }: Props) {
  const supabase = createClient();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let uid = userId;
    if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
    if (!uid) { setLoading(false); return; }
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", uid).gte("date", from).lte("date", to).order("date", { ascending: false }),
      supabase.from("work_logs").select("*").eq("user_id", uid).gte("date", from).lte("date", to).order("date", { ascending: false }),
    ]);
    setAttendance(att ?? []); setLogs(wl ?? []); setLoading(false);
  }, [supabase, from, to, userId]);

  useEffect(() => { load(); }, [load]);

  async function deleteDayRecord(date: string) {
    let uid = userId;
    if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
    if (!uid) return;
    await Promise.all([
      supabase.from("attendance").delete().eq("user_id", uid).eq("date", date),
      supabase.from("work_logs").delete().eq("user_id", uid).eq("date", date),
    ]);
    setAttendance(prev => prev.filter(a => a.date !== date));
    setLogs(prev => prev.filter(l => l.date !== date));
  }

  const attCounts = attendance.reduce((acc: Record<string, number>, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});
  const logCounts = logs.reduce((acc: Record<string, number>, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {});
  const chartData = Object.entries(logCounts).map(([status, count]) => ({ status, label: statusLabel(status), count }));
  const logsByDate = logs.reduce((acc: Record<string, LogRow[]>, l) => { if (!acc[l.date]) acc[l.date] = []; acc[l.date].push(l); return acc; }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 700 }}>
          {employeeName ? `${employeeName}` : "History"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>
          {employeeName ? "Full attendance and work log history" : "Your attendance and work log over time"}
        </p>
      </div>

      {/* Date range */}
      <div className="card-sm history-filters" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="input-label">From</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="input-label">To</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? <span className="spinner" /> : "Search"}
        </button>
      </div>

      {/* Search filter */}
      {(logs.length > 0 || attendance.length > 0) && (
        <div className="search-wrap">
          <input
            className="input"
            type="text"
            placeholder="Search tasks, projects, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Attendance stat cards */}
      {attendance.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: ".75rem" }}>
          {(["PRESENT","WFH","HALF_DAY","LEAVE"] as AttendanceStatus[]).map(s => (
            <div key={s} className="stat-card">
              <div className="stat-value" style={{ color: s === "PRESENT" ? "var(--present)" : s === "WFH" ? "var(--wfh)" : s === "HALF_DAY" ? "var(--half-day)" : s === "LEAVE" ? "var(--to-impl)" : "var(--absent)" }}>
                {attCounts[s] ?? 0}
              </div>
              <div className="stat-label">{statusLabel(s)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: ".95rem", fontWeight: 600, marginBottom: "1.25rem" }}>Work Items by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={32}>
              <XAxis dataKey="label" tick={{ fill: "#8b92a3", fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#8b92a3", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {chartData.map(e => <Cell key={e.status} fill={STATUS_COLORS[e.status] ?? "#8b92a3"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Day-by-day */}
      {attendance.length === 0 && logs.length === 0 ? (
        <div className="empty-state">No data found for this date range.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[...new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)])].sort().reverse()
            .filter(date => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              const att = attendance.find(a => a.date === date);
              const dayLogs = logsByDate[date] ?? [];
              if (att?.notes?.toLowerCase().includes(q)) return true;
              if (att?.status?.toLowerCase().includes(q)) return true;
              return dayLogs.some(l => l.task.toLowerCase().includes(q) || l.client_or_project?.toLowerCase().includes(q) || l.status.toLowerCase().includes(q));
            })
            .map(date => {
            const att = attendance.find(a => a.date === date);
            const dayLogs = logsByDate[date] ?? [];
            return (
              <div key={date} className="card-sm" style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                {/* Date + status row */}
                <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
                  <span className="font-mono" style={{ fontSize: ".82rem", color: "var(--text-muted)", minWidth: 110 }}>{fmtDate(date)}</span>
                  {att ? (
                    <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                      <span className={`status-dot ${statusDotClass(att.status)}`} />
                      <span style={{ fontSize: ".8rem", fontWeight: 600 }}>{statusLabel(att.status)}</span>
                    </div>
                  ) : <span style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>No attendance</span>}
                  {!userId && <div style={{ marginLeft: "auto" }}>
                    {confirmDeleteDate === date ? (
                      <div className="animate-in" style={{ display: "flex", alignItems: "center", gap: ".4rem", flexShrink: 0 }}>
                        <span style={{ fontSize: ".7rem", fontWeight: 700, color: "#dc2626", whiteSpace: "nowrap" }}>⚠️ Delete this entire day?</span>
                        <button onClick={() => { deleteDayRecord(date); setConfirmDeleteDate(null); }} className="btn btn-danger" style={{ padding: ".2rem .5rem", fontSize: ".65rem", boxShadow: "var(--shadow-xs)" }}>
                          Yes, Delete
                        </button>
                        <button onClick={() => setConfirmDeleteDate(null)} className="btn btn-ghost" style={{ padding: ".2rem .5rem", fontSize: ".65rem", boxShadow: "var(--shadow-xs)" }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteDate(date)} className="btn btn-danger" style={{ padding: ".2rem .5rem", fontSize: ".65rem", flexShrink: 0, boxShadow: "var(--shadow-xs)" }}>
                        🗑️ Delete Day
                      </button>
                    )}
                  </div>}
                </div>
                {/* Attendance note — separate clean block */}
                {att?.notes && (
                  <div style={{
                    marginLeft: "110px",
                    paddingLeft: ".75rem",
                    borderLeft: "2px solid var(--border)",
                    color: "var(--text-muted)",
                    fontSize: ".78rem",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                  }}>
                    {att.notes}
                  </div>
                )}
                {dayLogs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: ".4rem", paddingLeft: "1rem", borderLeft: "2px solid var(--border)" }}>
                    {dayLogs.map(l => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                        <span className={`status-dot ${statusDotClass(l.status)}`} />
                        <span style={{ fontSize: ".85rem", flex: 1 }}>{l.task}</span>
                        <span className={badgeClass(l.status)} style={{ fontSize: ".65rem" }}>{statusLabel(l.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
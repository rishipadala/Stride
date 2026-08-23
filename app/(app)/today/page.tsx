"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusDotClass, statusLabel, todayISO } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";
type WorkLogStatus = "DONE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "TO_IMPLEMENT" | "BLOCKED";

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT",  label: "Present" },
  { value: "WFH",      label: "WFH" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "LEAVE",    label: "Leave" },
];

const LOG_STATUS_OPTIONS: { value: WorkLogStatus; label: string }[] = [
  { value: "DONE",              label: "Done" },
  { value: "IN_PROGRESS",       label: "In Progress" },
  { value: "WAITING_ON_CLIENT", label: "Waiting on Client" },
  { value: "TO_IMPLEMENT",      label: "To Implement" },
  { value: "BLOCKED",           label: "Blocked" },
];

const STATUS_COLORS: Record<WorkLogStatus, { bg: string; color: string }> = {
  DONE: { bg: "#bbf7d0", color: "#15803d" },
  IN_PROGRESS: { bg: "#bfdbfe", color: "#1d4ed8" },
  WAITING_ON_CLIENT: { bg: "#fde68a", color: "#92400e" },
  TO_IMPLEMENT: { bg: "#e9d5ff", color: "#7e22ce" },
  BLOCKED: { bg: "#fecaca", color: "#dc2626" },
};

interface WorkLog { id: string; task: string; client_or_project: string | null; status: WorkLogStatus; }

export default function TodayPage() {
  const supabase = createClient();
  const today = todayISO();

  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [attNotes, setAttNotes] = useState("");
  const [attLoading, setAttLoading] = useState(false);

  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [task, setTask] = useState("");
  const [project, setProject] = useState("");
  const [logStatus, setLogStatus] = useState<WorkLogStatus>("IN_PROGRESS");
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Stats state
  const [streak, setStreak] = useState(0);
  const [weekStats, setWeekStats] = useState({ done: 0, total: 0, topProject: "" });
  const [monthDays, setMonthDays] = useState(0);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("start_date, full_name").eq("id", user.id).single();
    if (profile?.start_date) setStartDate(profile.start_date);
    if (profile?.full_name) setUserName(profile.full_name);

    // Current date data
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", selectedDate).maybeSingle(),
      supabase.from("work_logs").select("*").eq("user_id", user.id).eq("date", selectedDate).order("created_at", { ascending: false }),
    ]);
    if (att) { setAttendance(att.status); setAttNotes(att.notes ?? ""); }
    else { setAttendance(null); setAttNotes(""); }
    setLogs(wl ?? []);

    // --- STATS (only for today view) ---
    const now = new Date();
    const todayStr = todayISO();

    // Streak — load recent attendance
    const { data: allAtt } = await supabase
      .from("attendance").select("date")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(365);
    const attDates = new Set((allAtt ?? []).map(a => a.date));
    let streakCount = 0;
    const d = new Date(now);
    // Start from today or last weekday
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    let skippedToday = false;
    while (true) {
      const ds = d.toISOString().split("T")[0];
      const day = d.getDay();
      if (day === 0 || day === 6) { d.setDate(d.getDate() - 1); continue; }
      if (attDates.has(ds)) { streakCount++; d.setDate(d.getDate() - 1); }
      else {
        if (!skippedToday && ds === todayStr) { skippedToday = true; d.setDate(d.getDate() - 1); continue; }
        break;
      }
    }
    setStreak(streakCount);

    // Week stats
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekStartStr = monday.toISOString().split("T")[0];
    const { data: weekLogs } = await supabase
      .from("work_logs").select("status,client_or_project")
      .eq("user_id", user.id).gte("date", weekStartStr).lte("date", todayStr);
    const wlArr = weekLogs ?? [];
    const doneCount = wlArr.filter(l => l.status === "DONE").length;
    const projCounts: Record<string, number> = {};
    wlArr.forEach(l => { if (l.client_or_project) projCounts[l.client_or_project] = (projCounts[l.client_or_project] ?? 0) + 1; });
    const topProject = Object.entries(projCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    setWeekStats({ done: doneCount, total: wlArr.length, topProject });

    // Month days
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: monthAtt } = await supabase
      .from("attendance").select("date")
      .eq("user_id", user.id).gte("date", monthStart);
    setMonthDays((monthAtt ?? []).length);

    setPageLoading(false);
  }, [supabase, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  async function markAttendance(status: AttendanceStatus) {
    setAttLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("attendance").upsert({ user_id: user!.id, date: selectedDate, status, notes: attNotes }, { onConflict: "user_id,date" });
    setAttendance(status);
    setAttLoading(false);
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) { setLogError("Task description is required"); return; }
    setLogError(""); setLogLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("work_logs").insert({
      user_id: user!.id, date: selectedDate, task: task.trim(),
      client_or_project: project.trim() || null, status: logStatus,
    }).select().single();
    if (data) { setLogs(prev => [data, ...prev]); setTask(""); setProject(""); setLogStatus("IN_PROGRESS"); }
    setLogLoading(false);
  }

  async function deleteLog(id: string) {
    await supabase.from("work_logs").delete().eq("id", id);
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  async function updateLogStatus(id: string, newStatus: WorkLogStatus) {
    await supabase.from("work_logs").update({ status: newStatus }).eq("id", id);
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const dateObject = new Date(year, month - 1, day);
  const dateDisplay = isNaN(dateObject.getTime()) ? selectedDate : dateObject.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isToday = selectedDate === today;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName ? userName.split(" ")[0] : null;

  const todayDayIndex = now.getDay();
  const dayName = now.toLocaleDateString("en-IN", { weekday: "long" });

  const getDayContext = (): { emoji: string; msg: string; type: "work" | "flex" | "off" } => {
    switch (todayDayIndex) {
      case 0: return { emoji: "🕷️", msg: "Even heroes rest. Recharge, Spider-Fan!", type: "off" };
      case 6: return { emoji: "🕸️", msg: "Half-day vibes — your Spidey senses say chill.", type: "flex" };
      case 1: return { emoji: "🕷️", msg: "With great power comes great productivity!", type: "work" };
      case 5: return { emoji: "🕸️", msg: "Friday — another week saved by your friendly neighborhood dev!", type: "work" };
      case 2: return { emoji: "🦸", msg: "Anyone can be a hero. Today it's your turn!", type: "work" };
      case 3: return { emoji: "⚡", msg: "Midweek hustle — Spidey never quits!", type: "work" };
      case 4: return { emoji: "🕷️", msg: "Almost Friday — keep swinging!", type: "work" };
      default: return { emoji: "💪", msg: "Let's get things done!", type: "work" };
    }
  };
  const dayCtx = getDayContext();

  const streakMsg = streak === 0 ? "Start your streak today!" : streak < 5 ? "Keep it going!" : streak < 15 ? "You're on fire!" : "Unstoppable! 🏆";

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          {isToday && (
            <>
              <div style={{ fontSize: "1.05rem", color: "var(--text)", fontWeight: 600, marginBottom: ".35rem", opacity: 0.75 }}>
                {greeting}{firstName ? `, ${firstName}` : ""}! 👋
              </div>
              <div className="day-banner" style={{
                display: "inline-flex", alignItems: "center", gap: ".5rem",
                padding: ".35rem .85rem", borderRadius: "999px",
                border: "2px solid var(--border)", fontSize: ".82rem", fontWeight: 700,
                marginBottom: ".6rem",
                background: dayCtx.type === "off" ? "#bbf7d0" : dayCtx.type === "flex" ? "#fde68a" : todayDayIndex === 5 ? "#e9d5ff" : todayDayIndex === 1 ? "#bfdbfe" : "var(--surface)",
                color: dayCtx.type === "off" ? "#15803d" : dayCtx.type === "flex" ? "#92400e" : todayDayIndex === 5 ? "#7e22ce" : todayDayIndex === 1 ? "#1d4ed8" : "var(--text)",
                boxShadow: "var(--shadow-xs)",
              }}>
                <span style={{ fontSize: "1.1rem" }}>{dayCtx.emoji}</span>
                <span>{dayName}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ fontWeight: 600 }}>{dayCtx.msg}</span>
              </div>
            </>
          )}
          <div className="font-mono" style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".35rem" }}>{dateDisplay}</div>
          <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 800 }}>
            {isToday ? "Today\u2019s Log" : "Daily Log"}
          </h1>
        </div>
        <div className="form-group" style={{ minWidth: 160 }}>
          <label className="input-label" style={{ marginBottom: "0.2rem" }}>Select Date</label>
          <input type="date" className="input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={startDate ?? undefined} max={today} style={{ padding: ".45rem .75rem" }} />
        </div>
      </div>

      {pageLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "30vh" }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <>
          {/* Personal Stats — Streak + This Week */}
          {isToday && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: ".75rem" }} className="stats-grid">
              {/* Streak */}
              <div className="stat-card" style={{ position: "relative", overflow: "hidden" }}>
                <div className={`stat-value ${streak >= 3 ? "streak-fire" : ""}`} style={{ color: streak > 0 ? "var(--present)" : "var(--text-muted)" }}>
                  {streak > 0 ? `🔥 ${streak}` : "0"}
                </div>
                <div className="stat-label">Day Streak</div>
                <div style={{ fontSize: ".65rem", color: "var(--text-muted)", marginTop: ".2rem", fontWeight: 500 }}>{streakMsg}</div>
              </div>
              {/* Tasks Done This Week */}
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--present)" }}>{weekStats.done}</div>
                <div className="stat-label">Done This Week</div>
              </div>
              {/* Total Entries This Week */}
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--wfh)" }}>{weekStats.total}</div>
                <div className="stat-label">Entries This Week</div>
              </div>
              {/* Days Logged This Month */}
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--to-impl)" }}>{monthDays}</div>
                <div className="stat-label">Days This Month</div>
              </div>
              {/* Top Project */}
              {weekStats.topProject !== "—" && (
                <div className="stat-card stat-span-2" style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--half-day)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📂 {weekStats.topProject}
                  </div>
                  <div className="stat-label">Top Project This Week</div>
                </div>
              )}
            </div>
          )}

          {/* Attendance */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>
                {attendance ? `✅ Marked — ${statusLabel(attendance)}` : "How's today looking?"}
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".6rem", marginBottom: "1rem" }} className="att-grid-4">
              {ATTENDANCE_OPTIONS.map(opt => {
                const emoji: Record<string, string> = { PRESENT: "🏢", WFH: "🏠", HALF_DAY: "⏰", LEAVE: "🌴" };
                const isActive = attendance === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={`att-card ${isActive ? `att-active-${opt.value}` : ""}`}
                    onClick={() => markAttendance(opt.value)}
                    disabled={attLoading}
                    id={`att-${opt.value.toLowerCase()}`}
                  >
                    <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{emoji[opt.value]}</span>
                    <span style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".03em" }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {attendance && (() => {
              const reactions: Record<string, { msg: string; emoji: string }> = {
                PRESENT: { msg: "You're in! Let's make today count.", emoji: "💪" },
                WFH: { msg: "Working from home — cozy & productive!", emoji: "🛋️" },
                HALF_DAY: { msg: "Half day — make the most of it!", emoji: "⚡" },
                LEAVE: { msg: "Enjoy your time off! You've earned it.", emoji: "🎉" },
              };
              const r = reactions[attendance];
              return (
                <div className="att-reaction" style={{
                  display: "flex", alignItems: "center", gap: ".6rem",
                  padding: ".6rem .9rem", borderRadius: "var(--radius-sm)",
                  border: "2px solid var(--border)", marginBottom: "1rem",
                  background: ({ PRESENT: "#bbf7d0", WFH: "#bfdbfe", HALF_DAY: "#fde68a", LEAVE: "#e9d5ff" } as Record<string, string>)[attendance] ?? "var(--surface-alt)",
                  fontSize: ".85rem", fontWeight: 600,
                  boxShadow: "var(--shadow-xs)",
                }}>
                  <span style={{ fontSize: "1.2rem" }}>{r.emoji}</span>
                  <span>{r.msg}</span>
                </div>
              );
            })()}

            <div className="form-group">
              <label className="input-label">Notes (optional)</label>
              <input className="input" type="text" placeholder="Any notes for this day..." value={attNotes} onChange={e => setAttNotes(e.target.value)} onBlur={() => attendance && markAttendance(attendance)} />
            </div>
            {!attendance && (
              <p style={{ marginTop: ".75rem", fontSize: ".8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                👆 Pick one to mark your attendance for {isToday ? "today" : "this day"}
              </p>
            )}
          </div>

          {/* Work Logs */}
          <div className="card">
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
              Work Log &mdash; {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </h2>

            <form onSubmit={addLog} style={{ display: "flex", flexDirection: "column", gap: ".85rem", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "2px solid var(--border)" }}>
              {logError && <div className="alert alert-error">{logError}</div>}
              <div className="form-group">
                <label className="input-label">Task *</label>
                <input id="log-task" className="input" type="text" placeholder="What did you work on?" value={task} onChange={e => setTask(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }} className="form-grid-2">
                <div className="form-group">
                  <label className="input-label">Client / Project</label>
                  <input id="log-project" className="input" type="text" placeholder="Optional" value={project} onChange={e => setProject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="input-label">Status</label>
                  <select id="log-status" className="input" value={logStatus} onChange={e => setLogStatus(e.target.value as WorkLogStatus)}>
                    {LOG_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <button id="log-add" className="btn btn-primary" type="submit" disabled={logLoading} style={{ alignSelf: "flex-start" }}>
                {logLoading ? <span className="spinner" /> : "+ Add Entry"}
              </button>
            </form>

            {logs.length === 0 ? (
              <div className="empty-state">No entries for this day. Add your first work log above.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: ".65rem" }}>
                {logs.map(log => (
                  <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", padding: ".85rem 1rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", border: "2px solid var(--border)", boxShadow: "var(--shadow-xs)" }} className="log-entry">
                    <span className={`status-dot ${statusDotClass(log.status as WorkLogStatus)}`} style={{ marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: ".25rem" }}>{log.task}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
                        <select
                          className="status-select"
                          value={log.status}
                          onChange={(e) => updateLogStatus(log.id, e.target.value as WorkLogStatus)}
                          style={{
                            backgroundColor: STATUS_COLORS[log.status].bg,
                            color: STATUS_COLORS[log.status].color,
                          }}
                        >
                          {LOG_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {log.client_or_project && (
                          <span style={{ fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 500 }}>&middot; {log.client_or_project}</span>
                        )}
                      </div>
                    </div>
                    {confirmDeleteId === log.id ? (
                      <div className="animate-in log-entry-actions" style={{ display: "flex", alignItems: "center", gap: ".35rem", flexShrink: 0 }}>
                        <span style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Sure?</span>
                        <button onClick={() => { deleteLog(log.id); setConfirmDeleteId(null); }} className="btn btn-danger" style={{ padding: ".25rem .5rem", fontSize: ".68rem", boxShadow: "var(--shadow-xs)" }}>
                          Delete
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost" style={{ padding: ".25rem .5rem", fontSize: ".68rem", boxShadow: "var(--shadow-xs)" }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(log.id)} className="btn btn-danger" style={{ padding: ".3rem .6rem", fontSize: ".75rem", flexShrink: 0, boxShadow: "var(--shadow-xs)" }}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
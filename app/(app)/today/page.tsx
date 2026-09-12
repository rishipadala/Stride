"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { statusDotClass, statusLabel, todayISO, toISODate } from "@/lib/utils";
import { computeStats, type AttLike } from "@/lib/achievements";
import { webBurstFrom } from "@/lib/webBurst";
import { getQuote, contextForMoment, type QuoteContext } from "@/lib/quotes";
import Quip from "@/components/Quip";

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

interface WorkLog { id: string; task: string; client_or_project: string | null; status: WorkLogStatus; }

function TodayPageInner() {
  const supabase = createClient();
  const today = todayISO();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const validDateParam = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : null;

  const [selectedDate, setSelectedDate] = useState(validDateParam ?? today);
  const cameFromHistory = validDateParam !== null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Stats state
  const [streak, setStreak] = useState(0);
  const [weekStats, setWeekStats] = useState({ done: 0, total: 0, topProject: "" });
  const [monthDays, setMonthDays] = useState(0);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    // Bailing out early used to leave pageLoading true forever, so an
    // expired session showed a spinner that never resolved.
    if (!user) { setPageLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("start_date, full_name").eq("id", user.id).single();
    if (profile?.start_date) setStartDate(profile.start_date);
    if (profile?.full_name) setUserName(profile.full_name);

    // Current date data
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("status, notes").eq("user_id", user.id).eq("date", selectedDate).maybeSingle(),
      supabase.from("work_logs").select("id, task, client_or_project, status").eq("user_id", user.id).eq("date", selectedDate).order("created_at", { ascending: false }),
    ]);
    if (att) { setAttendance(att.status); setAttNotes(att.notes ?? ""); }
    else { setAttendance(null); setAttNotes(""); }
    setLogs(wl ?? []);

    // --- STATS (only for today view) ---
    const now = new Date();
    const todayStr = todayISO();

    // The streak comes from computeStats, the same function that
    // drives /achievements and the public profile. This page used to
    // roll its own loop against toISOString(), which reported
    // yesterday for anyone logging in before 05:30 IST — and could
    // disagree with the badge page on the very same screen.
    const { data: allAtt } = await supabase
      .from("attendance").select("date, status")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(365);
    setStreak(computeStats((allAtt ?? []) as AttLike[], []).currentStreak);

    // Week stats
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const { data: weekLogs } = await supabase
      .from("work_logs").select("status,client_or_project")
      .eq("user_id", user.id).gte("date", toISODate(monday)).lte("date", todayStr);
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

  async function markAttendance(status: AttendanceStatus, el?: Element | null) {
    setAttLoading(true);
    setActionError("");
    const previous = attendance;
    setAttendance(status);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAttendance(previous); setActionError("Your session expired. Sign in again."); setAttLoading(false); return; }

    const { error } = await supabase
      .from("attendance")
      .upsert({ user_id: user.id, date: selectedDate, status, notes: attNotes }, { onConflict: "user_id,date" });

    if (error) {
      // Roll back, or the button stays lit for a day that was never saved.
      setAttendance(previous);
      setActionError(`Couldn't save attendance: ${error.message}`);
    } else if (el) {
      webBurstFrom(el);
    }
    setAttLoading(false);
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) { setLogError("Task description is required"); return; }
    setLogError(""); setLogLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLogError("Your session expired. Sign in again."); setLogLoading(false); return; }

    const { data, error } = await supabase.from("work_logs").insert({
      user_id: user.id, date: selectedDate, task: task.trim(),
      client_or_project: project.trim() || null, status: logStatus,
    }).select("id, task, client_or_project, status").single();

    if (error) setLogError(error.message);
    else if (data) { setLogs(prev => [data, ...prev]); setTask(""); setProject(""); setLogStatus("IN_PROGRESS"); }
    setLogLoading(false);
  }

  async function deleteLog(id: string) {
    setActionError("");
    const snapshot = logs;
    setLogs(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from("work_logs").delete().eq("id", id);
    if (error) { setLogs(snapshot); setActionError(`Couldn't delete that entry: ${error.message}`); }
  }

  async function updateLogStatus(id: string, newStatus: WorkLogStatus) {
    setActionError("");
    const snapshot = logs;
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    const { error } = await supabase.from("work_logs").update({ status: newStatus }).eq("id", id);
    if (error) { setLogs(snapshot); setActionError(`Couldn't update that entry: ${error.message}`); }
  }

  function startEditing(log: WorkLog) {
    setConfirmDeleteId(null);
    setEditingId(log.id);
    setEditTask(log.task);
    setEditProject(log.client_or_project ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTask("");
    setEditProject("");
  }

  async function saveEdit(id: string) {
    if (!editTask.trim()) return;
    setEditLoading(true);
    setActionError("");
    const snapshot = logs;
    const newTask = editTask.trim();
    const newProject = editProject.trim() || null;
    setLogs(prev => prev.map(l => l.id === id ? { ...l, task: newTask, client_or_project: newProject } : l));
    const { error } = await supabase.from("work_logs").update({ task: newTask, client_or_project: newProject }).eq("id", id);
    if (error) { setLogs(snapshot); setActionError(`Couldn't save edits: ${error.message}`); }
    else { cancelEditing(); }
    setEditLoading(false);
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const dateObject = new Date(year, month - 1, day);
  const dateDisplay = isNaN(dateObject.getTime()) ? selectedDate : dateObject.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isToday = selectedDate === today;

  // "Now" is resolved after mount. Reading the clock during render
  // gives the server (UTC) and the browser (IST) different greetings
  // and weekday names, which React flags as a hydration mismatch.
  const [nowParts, setNowParts] = useState<{ hour: number; dayIndex: number } | null>(null);
  // The day's line. It used to be a local seven-string array keyed by
  // weekday, duplicating copy that already lived in lib/quotes.ts and
  // rotating on a seven-day cycle you'd have memorised by Thursday.
  // Same clock read now picks the context and the quotes engine picks
  // the line, so it varies by time of day and doesn't repeat weekly.
  const [quip, setQuip] = useState<{ text: string; ctx: QuoteContext } | null>(null);
  useEffect(() => {
    const n = new Date();
    setNowParts({ hour: n.getHours(), dayIndex: n.getDay() });
    const ctx = contextForMoment(n.getHours(), n.getDay());
    setQuip({ text: getQuote(ctx), ctx });
  }, []);

  const greeting = !nowParts ? "" : nowParts.hour < 12 ? "Good morning" : nowParts.hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName ? userName.split(" ")[0] : null;

  const streakMsg = streak === 0 ? "Start your streak today" : streak < 5 ? "Keep it going" : streak < 15 ? "You're on fire" : "Unstoppable";

  return (
    <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* ===== HEADER =====
          Was four stacked blocks: greeting, a colour-coded day banner,
          a mono date line, then the H1. Three of them restated the same
          day in a different hue. Now it reads top-down as who you are,
          where you are, and one aside, in one ink colour. */}
      <div className="page-head">
        <div>
          {cameFromHistory && (
            <div style={{ marginBottom: ".6rem" }}>
              <Link href="/history" className="btn btn-ghost" style={{ padding: ".25rem .6rem", fontSize: ".72rem", textDecoration: "none", display: "inline-flex" }}>
                Back to History
              </Link>
            </div>
          )}
          {isToday && greeting && (
            <div style={{ fontSize: ".92rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".25rem" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </div>
          )}
          <h1 className="font-title page-title">
            {isToday ? "Today’s Log" : "Daily Log"}
          </h1>
          <div className="font-mono" style={{ fontSize: ".76rem", color: "var(--text-muted)", marginTop: ".45rem", lineHeight: 1.5 }}>
            {dateDisplay}
          </div>
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="date-picker" style={{ marginBottom: "0.2rem" }}>Select Date</label>
          <input id="date-picker" type="date" className="input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={startDate ?? undefined} max={today} style={{ padding: ".45rem .75rem" }} />
        </div>
      </div>

      {/* Only on today — a caption about the morning makes no sense
          sitting over a Tuesday you're back-filling from History. */}
      {isToday && quip && (
        <Quip key={quip.text} quote={quip.text} context={quip.ctx} plate={streak >= 3} />
      )}

      {pageLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "30vh" }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <>
          {actionError && <div className="alert alert-error">{actionError}</div>}

          {/* ===== STATS =====
              Four numbers that used to arrive in four different hues
              — red glow, green, blue, purple — as if each measured a
              different KIND of thing. They don't; they're all counts.
              So they're all ink now, and the single yellow plate goes
              to the streak: the only one that can be lost. */}
          {isToday && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: ".75rem" }} className="stats-grid">
              <div className="stat-card stat-streak">
                <div className="stat-value">{streak}</div>
                <div className="stat-label">Day Streak</div>
                <div className="stat-note">{streakMsg}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{weekStats.done}</div>
                <div className="stat-label">Done This Week</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{weekStats.total}</div>
                <div className="stat-label">Entries This Week</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{monthDays}</div>
                <div className="stat-label">Days This Month</div>
              </div>
              {weekStats.topProject !== "—" && (
                <div className="stat-card stat-span-2">
                  <div className="stat-project">{weekStats.topProject}</div>
                  <div className="stat-label">Top Project This Week</div>
                </div>
              )}
            </div>
          )}

          {/* Attendance */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>
                {attendance ? `Marked — ${statusLabel(attendance)}` : "How's today looking?"}
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".6rem", marginBottom: "1rem" }} className="att-grid-4">
              {ATTENDANCE_OPTIONS.map(opt => {
                const isActive = attendance === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={`att-card ${isActive ? `att-active-${opt.value}` : ""}`}
                    onClick={(e) => markAttendance(opt.value, e.currentTarget)}
                    disabled={attLoading}
                    aria-pressed={isActive}
                    id={`att-${opt.value.toLowerCase()}`}
                  >
                    <span style={{ fontSize: ".82rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* The reaction banner that used to sit here repeated, in a
                fifth colour, what the heading and the lit-up button
                already say. */}

            <div className="form-group">
              <label className="input-label" htmlFor="att-notes">Notes (optional)</label>
              <input id="att-notes" className="input" type="text" placeholder="Any notes for this day..." value={attNotes} onChange={e => setAttNotes(e.target.value)} onBlur={() => attendance && markAttendance(attendance)} />
            </div>
            {!attendance && (
              <p style={{ marginTop: ".75rem", fontSize: ".8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Pick one to mark your attendance for {isToday ? "today" : "this day"}
              </p>
            )}
          </div>

          {/* Work Logs */}
          <div className="card">
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
              Work Log &mdash; {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </h2>

            <form onSubmit={addLog} style={{ display: "flex", flexDirection: "column", gap: ".85rem", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "2.5px solid var(--border)" }}>
              {logError && <div className="alert alert-error">{logError}</div>}
              <div className="form-group">
                <label className="input-label" htmlFor="log-task">Task *</label>
                <input id="log-task" className="input" type="text" placeholder="What did you work on?" value={task} onChange={e => setTask(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }} className="form-grid-2">
                <div className="form-group">
                  <label className="input-label" htmlFor="log-project">Client / Project</label>
                  <input id="log-project" className="input" type="text" placeholder="Optional" value={project} onChange={e => setProject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="input-label" htmlFor="log-status">Status</label>
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
                  <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", padding: ".85rem 1rem", background: "var(--surface-alt)", border: `2.5px solid ${editingId === log.id ? "var(--accent)" : "var(--border)"}`, boxShadow: "var(--shadow-xs)", transition: "border-color var(--dur) var(--ease)" }} className="log-entry">
                    <span className={`status-dot ${statusDotClass(log.status as WorkLogStatus)}`} style={{ marginTop: editingId === log.id ? 10 : 5, transition: "margin-top var(--dur) var(--ease)" }} />

                    {editingId === log.id ? (
                      /* ── Inline edit form ── */
                      <form
                        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: ".55rem" }}
                        onSubmit={(e) => { e.preventDefault(); saveEdit(log.id); }}
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEditing(); }}
                      >
                        <input
                          autoFocus
                          className="input"
                          style={{ padding: ".35rem .6rem", fontSize: ".88rem" }}
                          value={editTask}
                          onChange={e => setEditTask(e.target.value)}
                          placeholder="Task description"
                          aria-label="Edit task"
                        />
                        <input
                          className="input"
                          style={{ padding: ".35rem .6rem", fontSize: ".82rem" }}
                          value={editProject}
                          onChange={e => setEditProject(e.target.value)}
                          placeholder="Client / Project (optional)"
                          aria-label="Edit client or project"
                        />
                        <div style={{ display: "flex", gap: ".4rem" }}>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={editLoading || !editTask.trim()}
                            style={{ padding: ".28rem .65rem", fontSize: ".75rem", boxShadow: "var(--shadow-xs)" }}
                          >
                            {editLoading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Save"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={cancelEditing}
                            style={{ padding: ".28rem .65rem", fontSize: ".75rem", boxShadow: "var(--shadow-xs)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* ── Read view ── */
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: ".25rem" }}>{log.task}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
                          <select
                            className={`status-select badge-${log.status}`}
                            aria-label={`Status for ${log.task}`}
                            value={log.status}
                            onChange={(e) => updateLogStatus(log.id, e.target.value as WorkLogStatus)}
                          >
                            {LOG_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {log.client_or_project && (
                            <span style={{ fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 500 }}>&middot; {log.client_or_project}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Action buttons (only in read view) ── */}
                    {editingId !== log.id && (
                      confirmDeleteId === log.id ? (
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
                        <div style={{ display: "flex", alignItems: "center", gap: ".3rem", flexShrink: 0 }}>
                          <button
                            onClick={() => startEditing(log)}
                            aria-label={`Edit "${log.task}"`}
                            className="btn btn-ghost"
                            style={{ padding: ".3rem .55rem", fontSize: ".75rem", boxShadow: "var(--shadow-xs)", lineHeight: 1 }}
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(log.id)}
                            aria-label={`Delete "${log.task}"`}
                            className="btn btn-danger"
                            style={{ padding: ".3rem .6rem", fontSize: ".75rem", boxShadow: "var(--shadow-xs)" }}
                          >
                            &times;
                          </button>
                        </div>
                      )
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

export default function TodayPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>}>
      <TodayPageInner />
    </Suspense>
  );
}
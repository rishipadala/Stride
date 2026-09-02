"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statusLabel } from "@/lib/utils";
import { getQuote } from "@/lib/quotes";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, addMonths, eachDayOfInterval, format, getDay,
} from "date-fns";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";
type WorkLogStatus = "DONE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "TO_IMPLEMENT" | "BLOCKED";

interface AttRow { date: string; status: AttendanceStatus; notes: string | null; }
interface LogRow { id: string; date: string; task: string; client_or_project: string | null; status: WorkLogStatus; }

type Period = "week" | "month";

const ATT_ORDER: AttendanceStatus[] = ["PRESENT", "WFH", "HALF_DAY", "LEAVE"];
const ATT_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "var(--present)", WFH: "var(--wfh)", HALF_DAY: "var(--half-day)", LEAVE: "var(--to-impl)",
};
const LOG_ORDER: WorkLogStatus[] = ["DONE", "IN_PROGRESS", "WAITING_ON_CLIENT", "TO_IMPLEMENT", "BLOCKED"];
const LOG_COLOR: Record<WorkLogStatus, string> = {
  DONE: "#6fae7f", IN_PROGRESS: "#5b9bd5", WAITING_ON_CLIENT: "#c9974c",
  TO_IMPLEMENT: "#9b8fd4", BLOCKED: "#c96b6b",
};

// Local-date ISO key (NOT toISOString — that's UTC and shifts the day for IST users).
const iso = (d: Date) => format(d, "yyyy-MM-dd");

interface Props { userId?: string; employeeName?: string; }

export default function WeeklyDigest({ userId }: Props) {
  const supabase = createClient();
  const [period, setPeriod] = useState<Period>("week");
  // anchor/today are set after mount so server & client never disagree on "now".
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState("Keep swinging. You're doing great.");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const now = new Date();
    setAnchor(now);
    setToday(now);
  }, []);

  const range = useMemo(() => {
    if (!anchor) return null;
    return period === "week"
      ? { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
      : { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [anchor, period]);

  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    let uid = userId;
    if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
    if (!uid) { setLoading(false); return; }
    const from = iso(range.start), to = iso(range.end);
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", uid).gte("date", from).lte("date", to),
      supabase.from("work_logs").select("*").eq("user_id", uid).gte("date", from).lte("date", to),
    ]);
    setAttendance(att ?? []); setLogs(wl ?? []); setLoading(false);
  }, [supabase, range, userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const m = useMemo(() => {
    if (!range) return null;
    const days = eachDayOfInterval({ start: range.start, end: range.end });
    const attByDate = new Map(attendance.map(a => [a.date, a]));
    const logsByDate = logs.reduce((acc: Record<string, LogRow[]>, l) => {
      (acc[l.date] ??= []).push(l); return acc;
    }, {});

    const attCounts = attendance.reduce((acc: Record<string, number>, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1; return acc;
    }, {});
    const logCounts = logs.reduce((acc: Record<string, number>, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1; return acc;
    }, {});

    // Days actually engaged with (attendance marked or work logged).
    const engaged = new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)]);
    // Days in the period that have already happened (don't punish the future).
    const elapsed = today ? days.filter(d => iso(d) <= iso(today)).length : days.length;

    // Longest consecutive run of showing up (anything but LEAVE).
    let longestRun = 0, run = 0;
    for (const d of days) {
      const a = attByDate.get(iso(d));
      if (a && a.status !== "LEAVE") { run++; longestRun = Math.max(longestRun, run); }
      else if (a || iso(d) <= (today ? iso(today) : "")) run = 0;
    }

    const projects = Object.entries(
      logs.reduce((acc: Record<string, number>, l) => {
        const k = l.client_or_project?.trim();
        if (k) acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const bestDay = Object.entries(logsByDate).sort((a, b) => b[1].length - a[1].length)[0];
    const done = logCounts.DONE ?? 0;
    const doneRate = logs.length ? Math.round((done / logs.length) * 100) : 0;

    return {
      days, attByDate, logsByDate, attCounts, logCounts,
      engagedCount: engaged.size, elapsed, longestRun, projects, bestDay, done, doneRate,
      totalLogs: logs.length,
      showUpDays: (attCounts.PRESENT ?? 0) + (attCounts.WFH ?? 0) + (attCounts.HALF_DAY ?? 0),
    };
  }, [range, attendance, logs, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m) setQuote(getQuote(m.longestRun >= 3 ? "streak" : "general"));
  }, [m?.longestRun, period]); // eslint-disable-line react-hooks/exhaustive-deps

  function shift(dir: -1 | 1) {
    if (!anchor) return;
    setAnchor(period === "week" ? addWeeks(anchor, dir) : addMonths(anchor, dir));
  }

  // Can't peek into a period that hasn't started yet.
  const atLatest = useMemo(() => {
    if (!anchor || !today) return true;
    const next = period === "week" ? addWeeks(anchor, 1) : addMonths(anchor, 1);
    const nextStart = period === "week" ? startOfWeek(next, { weekStartsOn: 1 }) : startOfMonth(next);
    return iso(nextStart) > iso(today);
  }, [anchor, today, period]);

  if (!range || !m) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const label = period === "week"
    ? `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`
    : format(range.start, "MMMM yyyy");

  const isThisPeriod = today ? iso(range.start) <= iso(today) && iso(today) <= iso(range.end) : false;
  const leadBlanks = period === "month" ? (getDay(range.start) + 6) % 7 : 0;

  return (
    <div className="wd" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Period switch + nav */}
      <div className="card-sm wd-bar">
        <div className="wd-tabs">
          {(["week", "month"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`wd-tab ${period === p ? "active" : ""}`}
            >
              {p === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="wd-nav">
          <button onClick={() => shift(-1)} className="btn btn-ghost wd-arrow" title="Previous">←</button>
          <span className="font-mono wd-label">{label}</span>
          <button onClick={() => shift(1)} className="btn btn-ghost wd-arrow" disabled={atLatest} title="Next">→</button>
          {!isThisPeriod && (
            <button onClick={() => setAnchor(today)} className="btn btn-ghost wd-today">
              {period === "week" ? "This week" : "This month"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : m.engagedCount === 0 ? (
        <div className="empty-state">
          Nothing logged for this {period}. {isThisPeriod ? "Today's a great day to start." : "That one got away."}
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: ".75rem" }}>
            <div className="stat-card">
              <div className="stat-value">{m.engagedCount}<span className="wd-of">/{m.elapsed}</span></div>
              <div className="stat-label">Days Logged</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--present)" }}>{m.showUpDays}</div>
              <div className="stat-label">Days Showed Up</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#5b9bd5" }}>{m.totalLogs}</div>
              <div className="stat-label">Work Items</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#6fae7f" }}>{m.doneRate}%</div>
              <div className="stat-label">Done Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--half-day)" }}>{m.longestRun}</div>
              <div className="stat-label">Best Run</div>
            </div>
          </div>

          {/* Day grid */}
          <div className="card">
            <h2 className="wd-h2">{period === "week" ? "Your week at a glance" : "Your month at a glance"}</h2>
            <div className="wd-dow">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="wd-grid">
              {Array.from({ length: leadBlanks }).map((_, i) => <div key={`b${i}`} className="wd-cell blank" />)}
              {m.days.map(d => {
                const key = iso(d);
                const att = m.attByDate.get(key);
                const n = (m.logsByDate[key] ?? []).length;
                const future = today ? key > iso(today) : false;
                const isToday = today ? key === iso(today) : false;
                return (
                  <div
                    key={key}
                    className={`wd-cell ${future ? "future" : ""} ${isToday ? "is-today" : ""}`}
                    title={`${format(d, "EEE d MMM")}${att ? " · " + statusLabel(att.status) : ""}${n ? ` · ${n} item${n > 1 ? "s" : ""}` : ""}`}
                  >
                    <span className="wd-cell-day font-mono">{format(d, period === "week" ? "EEE d" : "d")}</span>
                    <span
                      className="wd-cell-dot"
                      style={{ background: att ? ATT_COLOR[att.status] : "transparent", borderStyle: att ? "solid" : "dashed" }}
                    />
                    {n > 0 && <span className="wd-cell-n font-mono">{n}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attendance split */}
          {attendance.length > 0 && (
            <div className="card">
              <h2 className="wd-h2">Attendance split</h2>
              <div className="wd-split">
                {ATT_ORDER.filter(s => m.attCounts[s]).map(s => (
                  <div
                    key={s}
                    className="wd-split-seg"
                    style={{ flexGrow: m.attCounts[s], background: ATT_COLOR[s] }}
                    title={`${statusLabel(s)}: ${m.attCounts[s]}`}
                  />
                ))}
              </div>
              <div className="wd-legend">
                {ATT_ORDER.filter(s => m.attCounts[s]).map(s => (
                  <span key={s} className="wd-legend-item">
                    <span className="wd-swatch" style={{ background: ATT_COLOR[s] }} />
                    {statusLabel(s)} <strong>{m.attCounts[s]}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Work breakdown + top projects */}
          <div className="wd-two">
            {m.totalLogs > 0 && (
              <div className="card">
                <h2 className="wd-h2">Work breakdown</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: ".55rem" }}>
                  {LOG_ORDER.filter(s => m.logCounts[s]).map(s => {
                    const pct = Math.round((m.logCounts[s] / m.totalLogs) * 100);
                    return (
                      <div key={s} className="wd-row">
                        <span className="wd-row-label">{statusLabel(s)}</span>
                        <div className="wd-row-track">
                          <div className="wd-row-fill" style={{ width: `${pct}%`, background: LOG_COLOR[s] }} />
                        </div>
                        <span className="wd-row-n font-mono">{m.logCounts[s]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {m.projects.length > 0 && (
              <div className="card">
                <h2 className="wd-h2">Top projects</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
                  {m.projects.map(([name, count], i) => (
                    <div key={name} className="wd-proj">
                      <span className="wd-proj-rank font-mono">{i + 1}</span>
                      <span className="wd-proj-name">{name}</span>
                      <span className="badge wd-proj-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlights */}
          <div className="card wd-highlight">
            <h2 className="wd-h2">Highlights</h2>
            <ul className="wd-list">
              {m.bestDay && (
                <li>
                  Busiest day was <strong>{format(new Date(m.bestDay[0] + "T00:00:00"), "EEEE, d MMM")}</strong>{" "}
                  with <strong>{m.bestDay[1].length}</strong> item{m.bestDay[1].length > 1 ? "s" : ""} logged.
                </li>
              )}
              {m.longestRun > 1 && <li>You showed up <strong>{m.longestRun} days in a row</strong>. That&apos;s the streak talking.</li>}
              {m.done > 0 && <li>You closed out <strong>{m.done}</strong> item{m.done > 1 ? "s" : ""} — {m.doneRate}% of everything you logged.</li>}
              {(m.logCounts.BLOCKED ?? 0) > 0 && <li><strong>{m.logCounts.BLOCKED}</strong> item{m.logCounts.BLOCKED > 1 ? "s" : ""} still blocked. Worth a nudge?</li>}
              {m.projects.length > 1 && <li>You juggled <strong>{m.projects.length}</strong> different projects. Multitasking hero.</li>}
            </ul>
            <div className="wd-quote font-mono">&ldquo;{quote}&rdquo;</div>
          </div>
        </>
      )}

      <style>{`
        .wd-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .wd-tabs { display: flex; gap: .35rem; }
        .wd-tab {
          padding: .4rem .75rem; font-size: .78rem; font-weight: 700; cursor: pointer;
          background: var(--surface); color: var(--text-muted);
          border: 2.5px solid var(--border);
          box-shadow: var(--shadow-xs); transition: transform .12s, background .15s, color .15s;
        }
        .wd-tab:hover { transform: translate(-1px,-1px); color: var(--text); }
        .wd-tab.active { background: var(--accent); color: #000; }
        .wd-nav { display: flex; align-items: center; gap: .5rem; margin-left: auto; }
        .wd-arrow { padding: .25rem .55rem; font-size: .8rem; box-shadow: var(--shadow-xs); }
        .wd-arrow:disabled { opacity: .35; cursor: not-allowed; }
        .wd-label { font-size: .8rem; font-weight: 600; min-width: 150px; text-align: center; }
        .wd-today { padding: .25rem .6rem; font-size: .68rem; box-shadow: var(--shadow-xs); }

        .wd-h2 { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; }
        .wd-of { font-size: .55em; color: var(--text-muted); font-weight: 600; }

        .wd-dow, .wd-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: .4rem; }
        .wd-dow { margin-bottom: .35rem; }
        .wd-dow span { text-align: center; font-size: .62rem; font-weight: 800; color: var(--text-muted); letter-spacing: .06em; }
        .wd-cell {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .25rem;
          min-height: 62px; padding: .35rem .2rem;
          background: var(--surface); border: 2.5px solid var(--border);
          box-shadow: var(--shadow-xs); position: relative;
        }
        .wd-cell.blank { background: transparent; border: none; box-shadow: none; }
        .wd-cell.future { opacity: .4; }
        .wd-cell.is-today { border-color: var(--cb-red, #d6202a); box-shadow: 3px 3px 0 0 var(--cb-red, #d6202a); }
        .wd-cell-day { font-size: .64rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        .wd-cell-dot { width: 12px; height: 12px; border: 2.5px solid var(--border); }
        .wd-cell-n { font-size: .58rem; font-weight: 700; color: var(--text-muted); }

        .wd-split { display: flex; height: 22px; gap: 2px; border: 2.5px solid var(--border); overflow: hidden; }
        .wd-split-seg { min-width: 6px; }
        .wd-legend { display: flex; flex-wrap: wrap; gap: .9rem; margin-top: .8rem; }
        .wd-legend-item { display: inline-flex; align-items: center; gap: .35rem; font-size: .74rem; color: var(--text-muted); }
        .wd-swatch { width: 10px; height: 10px; border: 2.5px solid var(--border); }

        .wd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start; }

        .wd-row { display: flex; align-items: center; gap: .6rem; }
        .wd-row-label { font-size: .75rem; font-weight: 600; min-width: 106px; }
        .wd-row-track { flex: 1; height: 12px; background: var(--surface-alt); border: 2.5px solid var(--border); overflow: hidden; }
        .wd-row-fill { height: 100%; }
        .wd-row-n { font-size: .72rem; font-weight: 700; min-width: 18px; text-align: right; }

        .wd-proj { display: flex; align-items: center; gap: .6rem; }
        .wd-proj-rank { font-size: .7rem; font-weight: 700; color: var(--text-muted); width: 14px; }
        .wd-proj-name { font-size: .82rem; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wd-proj-count { font-size: .65rem; }

        .wd-list { display: flex; flex-direction: column; gap: .5rem; padding-left: 1.1rem; margin: 0; }
        .wd-list li { font-size: .84rem; line-height: 1.5; color: var(--text-muted); }
        .wd-list strong { color: var(--text); }
        .wd-quote { margin-top: 1.1rem; padding-top: .9rem; border-top: 2px solid var(--border); font-size: .78rem; font-style: italic; color: var(--text-muted); text-align: center; }

        @media (max-width: 700px) {
          .wd-two { grid-template-columns: 1fr; }
          .wd-nav { width: 100%; justify-content: space-between; margin-left: 0; }
          .wd-label { min-width: 0; flex: 1; }
          .wd-cell { min-height: 52px; }
          .wd-cell-day { font-size: .58rem; }
        }
      `}</style>
    </div>
  );
}

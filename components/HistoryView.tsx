"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { statusLabel, todayISO, isoDaysAgo } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "WFH" | "LEAVE";
type WorkLogStatus = "DONE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "TO_IMPLEMENT" | "BLOCKED";

interface AttRow { date: string; status: AttendanceStatus; notes: string | null; }
interface LogRow { id: string; date: string; task: string; client_or_project: string | null; status: WorkLogStatus; }

interface Props { userId?: string; employeeName?: string; hideHeader?: boolean; }

/* ============================================================
   THE RECORD READS AS A LEDGER, NOT A FEED.

   The previous version encoded every fact two or three times — a
   coloured dot AND a coloured badge for the same status, plus a bar
   chart repeating the same totals a third time — across nine
   saturated hues. Nothing could recede, so everything competed and
   the page had to be *read* rather than *scanned*.

   This version spends its colour budget deliberately:
     ink    — structure and every normal state
     red    — blocked work, the only thing that should alarm you
     yellow — today, the only orientation cue you need
   Status is carried by GLYPH SHAPE instead of hue, so a month of
   days is legible in one pass and stays legible in dark mode and
   for colour-blind readers. Aggregates live in the Digest tab,
   which is what that tab is for.
   ============================================================ */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/* Only the states that need chasing get a word. "Done" is the
   expected outcome, so it earns silence — a finished day renders as
   a clean list of plain sentences. */
const FLAG: Partial<Record<WorkLogStatus, string>> = {
  IN_PROGRESS: "In progress",
  WAITING_ON_CLIENT: "Waiting",
  TO_IMPLEMENT: "To do",
  BLOCKED: "Blocked",
};

const RANGES = [
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
];

/** Attendance as a printer's mark: one ink colour, four shapes. */
function AttMark({ status }: { status: AttendanceStatus | null }) {
  const S = { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": true as const };
  const box = <rect x={1} y={1} width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} />;
  if (status === "PRESENT") {
    return <svg {...S}><rect x={1} y={1} width={12} height={12} fill="currentColor" /></svg>;
  }
  if (status === "WFH") {
    return <svg {...S}>{box}<rect x={5} y={5} width={4} height={4} fill="currentColor" /></svg>;
  }
  if (status === "HALF_DAY") {
    return <svg {...S}>{box}<rect x={1} y={1} width={6} height={12} fill="currentColor" /></svg>;
  }
  if (status === "LEAVE") {
    return <svg {...S}>{box}<path d="M2 12 L12 2" stroke="currentColor" strokeWidth={2} /></svg>;
  }
  return <svg {...S}><rect x={1} y={1} width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 2" opacity={0.5} /></svg>;
}

export default function HistoryView({ userId, employeeName, hideHeader }: Props) {
  const supabase = createClient();
  const router = useRouter();

  // Dates are resolved after mount. Deriving them in a useState
  // initializer would run once on the server (UTC) and again in the
  // browser (IST) and hand React two different values to hydrate.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [today, setToday] = useState("");
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setFrom(isoDaysAgo(29));
    setTo(todayISO());
    setToday(todayISO());
  }, []);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    let uid = userId;
    if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
    if (!uid) { setLoading(false); return; }
    const [{ data: att }, { data: wl }] = await Promise.all([
      supabase.from("attendance").select("date,status,notes").eq("user_id", uid).gte("date", from).lte("date", to).order("date", { ascending: false }),
      supabase.from("work_logs").select("id,date,task,client_or_project,status").eq("user_id", uid).gte("date", from).lte("date", to).order("date", { ascending: false }),
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

  function applyRange(days: number) {
    setFrom(isoDaysAgo(days));
    setTo(todayISO());
  }

  // Resolved once per day rather than on every render, so "now"
  // never enters the render path.
  const presetFrom = useMemo(
    () => RANGES.map(r => isoDaysAgo(r.days)),
    [today]
  );

  /* One pass over the data builds the whole view: days in reverse
     order, grouped into months, with the filter applied to tasks
     rather than only to days — searching "invoice" used to return
     the matching day and then show you every unrelated task on it. */
  const months = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const attByDate = new Map(attendance.map(a => [a.date, a]));
    const logsByDate = new Map<string, LogRow[]>();
    for (const l of logs) {
      const arr = logsByDate.get(l.date);
      if (arr) arr.push(l); else logsByDate.set(l.date, [l]);
    }

    const dates = [...new Set([...attendance.map(a => a.date), ...logs.map(l => l.date)])]
      .sort().reverse();

    type Day = { date: string; att: AttRow | undefined; tasks: LogRow[]; blocked: number };
    const out: { key: string; title: string; days: Day[]; logged: number; blocked: number }[] = [];

    for (const date of dates) {
      const att = attByDate.get(date);
      const all = logsByDate.get(date) ?? [];
      let tasks = all;
      if (q) {
        tasks = all.filter(l =>
          l.task.toLowerCase().includes(q) ||
          l.client_or_project?.toLowerCase().includes(q) ||
          statusLabel(l.status).toLowerCase().includes(q));
        const attHit =
          att?.notes?.toLowerCase().includes(q) ||
          (att ? statusLabel(att.status).toLowerCase().includes(q) : false);
        if (!tasks.length && !attHit) continue;
      }
      const blocked = tasks.filter(t => t.status === "BLOCKED").length;
      const day: Day = { date, att, tasks, blocked };

      const key = date.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) {
        last.days.push(day); last.logged++; last.blocked += blocked;
      } else {
        const [y, m] = key.split("-");
        out.push({
          key,
          title: `${MONTHS[Number(m) - 1]} ${y}`,
          days: [day], logged: 1, blocked,
        });
      }
    }
    return out;
  }, [attendance, logs, filter]);

  const total = months.reduce((n, m) => n + m.logged, 0);
  const hasAny = attendance.length > 0 || logs.length > 0;

  return (
    <div className="hv">
      {!hideHeader && (
        <div>
          <h1 className="font-title hv-h1">{employeeName ?? "History"}</h1>
          <p className="hv-sub">
            {employeeName ? "Full attendance and work log history" : "Your attendance and work log over time"}
          </p>
        </div>
      )}

      {/* ===== CONTROLS =====
          The old "Search" button was dead weight: changing either
          date already re-runs the query through load()'s deps. It is
          replaced by the presets people actually reach for. */}
      <div className="hv-controls">
        <div className="hv-presets" role="group" aria-label="Quick date range">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              className={`hv-preset ${from === presetFrom[i] && to === today ? "is-on" : ""}`}
              onClick={() => applyRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="hv-dates">
          <label className="hv-date-field">
            <span>From</span>
            <input className="input" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="hv-date-field">
            <span>To</span>
            <input className="input" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {hasAny && (
        <div className="search-wrap">
          <input
            className="input"
            type="text"
            placeholder="Filter tasks, projects, notes..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter records"
          />
        </div>
      )}

      {/* ===== THE RECORD ===== */}
      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : !months.length ? (
        <div className="empty-state">
          {filter.trim()
            ? `Nothing matches "${filter.trim()}" in this range.`
            : "No records in this range yet."}
        </div>
      ) : (
        <>
          {filter.trim() && (
            <p className="hv-count font-mono">
              {total} {total === 1 ? "day" : "days"} matching
            </p>
          )}

          {months.map(m => (
            <section key={m.key} className="hv-month">
              <header className="hv-month-head">
                <h2 className="font-title hv-month-title">{m.title}</h2>
                <span className="hv-month-meta font-mono">
                  {m.logged} {m.logged === 1 ? "day" : "days"}
                  {m.blocked > 0 && <em className="hv-alarm"> · {m.blocked} blocked</em>}
                </span>
              </header>

              <div className="hv-days">
                {m.days.map(d => {
                  const dow = DOW[new Date(d.date + "T00:00:00").getDay()];
                  const isToday = d.date === today;
                  return (
                    <article key={d.date} className={`hv-day ${isToday ? "is-today" : ""}`}>
                      <div className="hv-date font-mono">
                        <span className="hv-dow">{dow}</span>
                        <span className="hv-dnum">{d.date.slice(8)}</span>
                      </div>

                      <div className="hv-mark" title={d.att ? statusLabel(d.att.status) : "Not marked"}>
                        <AttMark status={d.att?.status ?? null} />
                      </div>

                      <div className="hv-body">
                        <div className="hv-line">
                          <span className="hv-att">
                            {d.att ? statusLabel(d.att.status) : "Not marked"}
                          </span>
                          {isToday && <span className="hv-today-tag">Today</span>}
                          {d.att?.notes && <span className="hv-note">{d.att.notes}</span>}
                        </div>

                        {d.tasks.length > 0 && (
                          <ul className="hv-tasks">
                            {d.tasks.map(l => (
                              <li key={l.id} className={`hv-task ${l.status === "BLOCKED" ? "is-blocked" : ""}`}>
                                <span className="hv-bullet" aria-hidden="true" />
                                <span className="hv-task-txt">
                                  {l.task}
                                  {l.client_or_project && <span className="hv-proj"> — {l.client_or_project}</span>}
                                </span>
                                {FLAG[l.status] && <span className="hv-flag font-mono">{FLAG[l.status]}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Editing is rare; deleting is rarer and dangerous.
                          Thirty always-visible red buttons made destruction
                          the loudest thing on the page, so the controls stay
                          quiet until you reach for the row. */}
                      {!userId && (
                        <div className="hv-actions">
                          {confirmDelete === d.date ? (
                            <div className="hv-confirm animate-in">
                              <span className="hv-confirm-q">Delete this day?</span>
                              <button
                                type="button"
                                className="hv-btn is-danger"
                                onClick={() => { deleteDayRecord(d.date); setConfirmDelete(null); }}
                              >
                                Delete
                              </button>
                              <button type="button" className="hv-btn" onClick={() => setConfirmDelete(null)}>
                                Keep
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="hv-btn"
                                onClick={() => router.push(`/today?date=${d.date}`)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="hv-btn"
                                onClick={() => setConfirmDelete(d.date)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      <style>{`
        .hv { display: flex; flex-direction: column; gap: 1.5rem; }
        .hv-h1 { font-size: 2.2rem; font-weight: 900; line-height: .94; }
        .hv-sub { color: var(--text-muted); font-size: .9rem; }

        /* ----- controls ----- */
        .hv-controls {
          display: flex; flex-wrap: wrap; gap: 1rem;
          align-items: flex-end; justify-content: space-between;
          background: var(--surface);
          border: var(--border-w) solid var(--border);
          box-shadow: var(--shadow-sm);
          padding: .9rem 1rem;
        }
        .hv-presets { display: flex; }
        .hv-preset {
          font-family: "Inter", sans-serif;
          font-size: .74rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: .05em;
          padding: .45rem .8rem; cursor: pointer;
          background: var(--surface); color: var(--text-muted);
          border: 2.5px solid var(--border);
          margin-left: -2.5px;
          transition: background .12s, color .12s;
        }
        .hv-preset:first-child { margin-left: 0; }
        .hv-preset:hover { color: var(--text); background: var(--surface-alt); }
        .hv-preset.is-on { background: var(--accent); color: #000; }
        .hv-dates { display: flex; gap: .6rem; }
        .hv-date-field { display: flex; flex-direction: column; gap: .3rem; }
        .hv-date-field > span {
          font-size: .68rem; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: var(--text-muted);
        }
        .hv-date-field .input { padding: .4rem .6rem; font-size: .82rem; box-shadow: none; }

        .hv-count { font-size: .74rem; color: var(--text-muted); margin: -.5rem 0 0; }

        /* ----- month ----- */
        .hv-month { display: flex; flex-direction: column; }
        .hv-month-head {
          display: flex; align-items: baseline; gap: .75rem;
          justify-content: space-between;
          border-bottom: 2.5px solid var(--border);
          padding-bottom: .3rem; margin-bottom: .1rem;
        }
        .hv-month-title { font-size: 1.35rem; font-weight: 900; line-height: 1; }
        .hv-month-meta { font-size: .72rem; color: var(--text-muted); white-space: nowrap; }
        .hv-alarm { font-style: normal; color: var(--cb-red); font-weight: 500; }

        /* ----- the ledger spine -----
           One continuous rule down the month is what makes this read
           as a single record instead of a stack of floating cards. */
        .hv-days { border-left: 2.5px solid var(--border); margin-left: 3px; }

        .hv-day {
          display: grid;
          grid-template-columns: 52px 22px minmax(0, 1fr) auto;
          align-items: start;
          gap: .6rem;
          padding: .7rem .5rem .7rem .75rem;
          border-bottom: 1px solid var(--surface-alt);
        }
        .hv-day:last-child { border-bottom: none; }
        .hv-day:hover { background: var(--surface); }
        .hv-day.is-today { box-shadow: inset 4px 0 0 0 var(--accent); }

        .hv-date { display: flex; flex-direction: column; line-height: 1.1; padding-top: 1px; }
        .hv-dow { font-size: .62rem; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); }
        .hv-dnum { font-size: 1.05rem; font-weight: 500; }

        .hv-mark { display: flex; padding-top: 3px; color: var(--text); }

        .hv-body { display: flex; flex-direction: column; gap: .35rem; min-width: 0; }
        .hv-line { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
        .hv-att { font-size: .82rem; font-weight: 700; }
        .hv-today-tag {
          font-family: "IBM Plex Mono", monospace;
          font-size: .6rem; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase;
          background: var(--accent); color: #000;
          border: 2px solid var(--border); padding: 0 .3rem;
        }
        .hv-note {
          font-size: .78rem; color: var(--text-muted); font-style: italic;
          min-width: 0; overflow-wrap: anywhere;
        }

        .hv-tasks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
        .hv-task { display: flex; align-items: baseline; gap: .5rem; font-size: .84rem; }
        .hv-bullet {
          width: 7px; height: 7px; flex-shrink: 0;
          margin-top: .42em;
          border: 1.5px solid var(--text-muted);
          background: var(--text-muted);
        }
        .hv-task-txt { min-width: 0; overflow-wrap: anywhere; }
        .hv-proj { color: var(--text-muted); }
        .hv-flag {
          margin-left: auto; flex-shrink: 0;
          font-size: .62rem; letter-spacing: .06em; text-transform: uppercase;
          color: var(--text-muted); white-space: nowrap;
          border-bottom: 1.5px solid var(--surface-alt);
        }
        /* Blocked work is the one thing allowed to raise its voice. */
        .hv-task.is-blocked .hv-bullet { background: var(--cb-red); border-color: var(--cb-red); }
        .hv-task.is-blocked .hv-flag { color: var(--cb-red); font-weight: 500; border-bottom-color: var(--cb-red); }

        /* ----- row actions ----- */
        .hv-actions { display: flex; align-items: center; gap: .3rem; opacity: 0; transition: opacity .12s; }
        .hv-day:hover .hv-actions,
        .hv-actions:focus-within { opacity: 1; }
        .hv-btn {
          font-family: "Inter", sans-serif;
          font-size: .66rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: .05em;
          padding: .22rem .5rem; cursor: pointer;
          background: var(--surface); color: var(--text-muted);
          border: 2px solid var(--border);
          transition: color .12s, background .12s;
        }
        .hv-btn:hover { color: var(--text); background: var(--surface-alt); }
        .hv-btn.is-danger { background: var(--cb-red); color: #fff; border-color: var(--border); }
        .hv-confirm { display: flex; align-items: center; gap: .35rem; }
        .hv-confirm-q {
          font-size: .68rem; font-weight: 700; color: var(--cb-red);
          white-space: nowrap;
        }

        /* Hover cannot be reached on touch, so the controls stay put. */
        @media (hover: none) {
          .hv-actions { opacity: 1; }
        }

        @media (max-width: 700px) {
          .hv-controls { flex-direction: column; align-items: stretch; }
          .hv-presets { width: 100%; }
          .hv-preset { flex: 1; text-align: center; }
          .hv-dates { width: 100%; }
          .hv-date-field { flex: 1; }
        }
        @media (max-width: 560px) {
          .hv-day {
            grid-template-columns: 44px 20px minmax(0, 1fr);
            gap: .5rem;
            padding-left: .6rem;
          }
          .hv-actions { grid-column: 3; opacity: 1; justify-content: flex-start; }
          .hv-flag { margin-left: 0; }
          .hv-task { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

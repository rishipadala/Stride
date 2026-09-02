"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getQuote } from "@/lib/quotes";
import {
  computeStats, evaluate, TIER_COLOR,
  type AttLike, type LogLike, type EvaluatedAchievement,
} from "@/lib/achievements";
import { format } from "date-fns";

export default function Achievements() {
  const supabase = createClient();
  const [items, setItems] = useState<EvaluatedAchievement[] | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<Record<string, string>>({});
  const [freshCodes, setFreshCodes] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState("Anyone can be a hero. Today, it's your turn.");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: att }, { data: logs }, { data: stored }] = await Promise.all([
      supabase.from("attendance").select("date,status").eq("user_id", user.id),
      supabase.from("work_logs").select("date,status,client_or_project").eq("user_id", user.id),
      supabase.from("achievements").select("code,unlocked_at").eq("user_id", user.id),
    ]);

    const stats = computeStats((att ?? []) as AttLike[], (logs ?? []) as LogLike[]);
    const evaluated = evaluate(stats);
    setItems(evaluated);

    const already = new Set((stored ?? []).map(r => r.code));
    setUnlockedAt(Object.fromEntries((stored ?? []).map(r => [r.code, r.unlocked_at])));

    // Persist anything newly earned so we know when it happened.
    const toInsert = evaluated.filter(a => a.unlocked && !already.has(a.code));
    if (toInsert.length > 0) {
      setFreshCodes(new Set(toInsert.map(a => a.code)));
      await supabase.from("achievements").upsert(
        toInsert.map(a => ({ user_id: user.id, code: a.code })),
        { onConflict: "user_id,code", ignoreDuplicates: true }
      );
      const now = new Date().toISOString();
      setUnlockedAt(prev => ({
        ...prev,
        ...Object.fromEntries(toInsert.map(a => [a.code, now])),
      }));
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!items) return;
    const any = items.some(a => a.unlocked);
    setQuote(getQuote(any ? "achievement" : "general"));
  }, [items]);

  if (!items) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const unlocked = items.filter(a => a.unlocked);
  const locked = items.filter(a => !a.unlocked);
  const pct = Math.round((unlocked.length / items.length) * 100);

  // Closest locked badge — the "you're almost there" nudge.
  const nextUp = [...locked].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="ac" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 700 }}>Achievements</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>
          Badges you&apos;ve earned by showing up. With great consistency comes great rewards.
        </p>
      </div>

      {/* Progress header */}
      <div className="card ac-head">
        <div className="ac-head-top">
          <div>
            <div className="ac-count font-title">
              {unlocked.length}<span className="ac-count-of">/{items.length}</span>
            </div>
            <div className="stat-label">Badges Unlocked</div>
          </div>
          <div className="ac-ring" style={{ "--pct": `${pct}%` } as React.CSSProperties}>
            <span className="font-mono">{pct}%</span>
          </div>
        </div>
        <div className="ac-track">
          <div className="ac-fill" style={{ width: `${pct}%` }} />
        </div>
        {nextUp && (
          <div className="ac-next">
            Closest: <strong>{nextUp.iconText} {nextUp.name}</strong> — {nextUp.current}/{nextUp.target}
          </div>
        )}
        <div className="ac-quote font-mono">&ldquo;{quote}&rdquo;</div>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="ac-h2">Earned</h2>
          <div className="ac-grid">
            {unlocked.map(a => (
              <div
                key={a.code}
                className={`ac-badge ${freshCodes.has(a.code) ? "fresh" : ""}`}
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="ac-emoji font-title" style={{ background: TIER_COLOR[a.tier] }}>{a.iconText}</div>
                <div className="ac-name">{a.name}</div>
                <div className="ac-desc">{a.desc}</div>
                <div className="ac-meta">
                  <span className="ac-tier" style={{ background: TIER_COLOR[a.tier] }}>{a.tier}</span>
                  {unlockedAt[a.code] && (
                    <span className="font-mono ac-date">
                      {format(new Date(unlockedAt[a.code]), "d MMM yyyy")}
                    </span>
                  )}
                </div>
                {freshCodes.has(a.code) && <span className="ac-new">NEW!</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <section>
          <h2 className="ac-h2">Still to come</h2>
          <div className="ac-grid">
            {locked.map(a => (
              <div key={a.code} className="ac-badge locked">
                <div className="ac-emoji locked-emoji font-title">{a.iconText}</div>
                <div className="ac-name">{a.name}</div>
                <div className="ac-desc">{a.desc}</div>
                <div className="ac-prog-track">
                  <div className="ac-prog-fill" style={{ width: `${a.pct}%`, background: TIER_COLOR[a.tier] }} />
                </div>
                <div className="ac-prog-label font-mono">{a.current} / {a.target}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .ac-head { display: flex; flex-direction: column; gap: .9rem; }
        .ac-head-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .ac-count { font-size: 2.4rem; font-weight: 800; line-height: 1; }
        .ac-count-of { font-size: .45em; color: var(--text-muted); font-weight: 700; }
        .ac-ring {
          width: 66px; height: 66px; flex-shrink: 0;
          border: 2.5px solid var(--border);
          background: conic-gradient(var(--accent) var(--pct), var(--surface-alt) 0);
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-xs);
        }
        .ac-ring span { font-size: .72rem; font-weight: 700; }
        .ac-track { height: 14px; background: var(--surface-alt); border: 2.5px solid var(--border); overflow: hidden; }
        .ac-fill { height: 100%; background: var(--accent); transition: width .5s ease; }
        .ac-next { font-size: .8rem; color: var(--text-muted); }
        .ac-next strong { color: var(--text); }
        .ac-quote { font-size: .78rem; font-style: italic; color: var(--text-muted); text-align: center; padding-top: .8rem; border-top: 2.5px solid var(--border); }

        .ac-h2 { font-size: .95rem; font-weight: 700; margin-bottom: .85rem; }
        .ac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: .9rem; }
        .ac-badge {
          position: relative; display: flex; flex-direction: column; gap: .4rem;
          padding: 1.1rem 1rem; background: var(--surface);
          border: 2.5px solid var(--border);
          box-shadow: var(--shadow); transition: transform .14s ease;
        }
        .ac-badge:hover { transform: translate(-2px, -2px); }
        .ac-badge.locked { opacity: .72; box-shadow: var(--shadow-xs); }
        .ac-emoji {
          width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; font-weight: 900; border: 2.5px solid var(--border);
          box-shadow: var(--shadow-xs); margin-bottom: .2rem;
          color: #000;
        }
        .ac-emoji.locked-emoji { background: var(--surface-alt); filter: grayscale(1); }
        .ac-name { font-size: 1rem; font-weight: 800; }
        .ac-desc { font-size: .76rem; color: var(--text-muted); line-height: 1.5; flex: 1; }
        .ac-meta { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: .3rem; }
        .ac-tier {
          font-size: .58rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
          padding: .15rem .45rem; border: 2.5px solid var(--border); color: #000;
        }
        .ac-date { font-size: .62rem; color: var(--text-muted); }
        .ac-prog-track { height: 8px; background: var(--surface-alt); border: 2.5px solid var(--border); overflow: hidden; margin-top: .35rem; }
        .ac-prog-fill { height: 100%; }
        .ac-prog-label { font-size: .62rem; color: var(--text-muted); text-align: right; }

        .ac-new {
          position: absolute; top: -9px; right: -9px;
          background: #dc2626; color: #fff; font-size: .55rem; font-weight: 800;
          letter-spacing: .06em; padding: .2rem .4rem;
          border: 2.5px solid var(--border);
        }
        .ac-badge.fresh { animation: ac-pop .5s ease; }
        @keyframes ac-pop {
          0% { transform: scale(.9); }
          60% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

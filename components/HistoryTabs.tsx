"use client";
import { useState } from "react";
import HistoryView from "./HistoryView";
import WeeklyDigest from "./WeeklyDigest";

type Tab = "digest" | "timeline";

const TABS: { id: Tab; label: string }[] = [
  { id: "digest", label: "Digest" },
  { id: "timeline", label: "Timeline" },
];

export default function HistoryTabs() {
  const [tab, setTab] = useState<Tab>("digest");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="font-title" style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: .94 }}>History</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>
          {tab === "digest"
            ? "Your week and month, summed up"
            : "Your attendance and work log over time"}
        </p>
      </div>

      {/* A real tab strip, not two buttons that look like one. Screen
          readers need the tablist/tab/tabpanel triad to announce "2 of 2"
          and to know the panel below belongs to the selected tab, and
          keyboard users expect arrow keys to move between tabs while Tab
          jumps past them into the panel. */}
      <div className="ht-tabs" role="tablist" aria-label="History views">
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              id={`ht-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`ht-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const next = TABS[(i + delta + TABS.length) % TABS.length];
                setTab(next.id);
                document.getElementById(`ht-tab-${next.id}`)?.focus();
              }}
              className={`ht-tab ${selected ? "active" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id={`ht-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`ht-tab-${tab}`}
        tabIndex={-1}
      >
        {tab === "digest" ? <WeeklyDigest /> : <HistoryView hideHeader />}
      </div>

      <style>{`
        .ht-tabs { display: flex; gap: .5rem; border-bottom: 2.5px solid var(--border); }
        .ht-tab {
          padding: .55rem 1.1rem; font-size: .85rem; font-weight: 800; cursor: pointer;
          color: var(--text-muted); background: var(--surface-alt);
          border: 2.5px solid var(--border); border-bottom: none;
          text-transform: uppercase; letter-spacing: .04em;
          margin-bottom: -2.5px; transition: background .15s, color .15s;
        }
        .ht-tab:hover { color: var(--text); }
        /* The active tab was floated up on a 2px -2px shadow — an offset
           direction the rest of the app never uses, so it read as a
           rendering glitch rather than a state. Selection is the yellow
           plate now, the same way it is in the sidebar. */
        .ht-tab.active { background: var(--accent); color: #000; }
        [role="tabpanel"]:focus { outline: none; }
      `}</style>
    </div>
  );
}

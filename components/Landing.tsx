"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getQuote } from "@/lib/quotes";

/* Set NEXT_PUBLIC_SOURCE_URL to the public repo and the footer grows a
   "Source" link. Left unset, the link is omitted entirely rather than
   pointing at github.com's front page — a nav item that goes nowhere
   reads as a broken build, not as "coming soon". */
const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL;

/* ============================================================
   ORIGINAL ARTWORK
   Every mark on this page is drawn here as SVG or CSS — the
   webs, the spiders, the skyline, the halftone. Nothing is
   traced from or copied out of a published comic, which keeps
   the page shippable in an open-source repo. The look comes
   from the *printing process* instead: pulp paper, Ben-Day
   dots, heavy ink borders, and plates that don't quite line up.
   ============================================================ */

/* ---------- A web, spun into one corner ---------- */
function WebCorner({ size = 300 }: { size?: number }) {
  const SPOKES = 7;
  const RINGS = [0.3, 0.48, 0.66, 0.84, 1.0];

  // Corner anchor is top-right; angles sweep from straight-down to straight-left.
  const pt = (i: number, r: number): [number, number] => {
    const a = Math.PI / 2 + (i / (SPOKES - 1)) * (Math.PI / 2);
    return [size + Math.cos(a) * r * size, Math.sin(a) * r * size];
  };

  const spokes = Array.from({ length: SPOKES }, (_, i) => {
    const [x, y] = pt(i, 1.03);
    return `M ${size} 0 L ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  // Rings sag toward the anchor between spokes, the way real silk does.
  const rings = RINGS.map((r) => {
    const [sx, sy] = pt(0, r);
    let d = `M ${sx.toFixed(1)} ${sy.toFixed(1)}`;
    for (let i = 0; i < SPOKES - 1; i++) {
      const [x2, y2] = pt(i + 1, r);
      const [cx, cy] = pt(i + 0.5, r * 0.89);
      d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return d;
  });

  return (
    <svg className="cb-web" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {spokes.map((d, i) => (
          <path key={`s${i}`} d={d} strokeWidth={1.5} />
        ))}
        {rings.map((d, i) => (
          <path key={`r${i}`} d={d} strokeWidth={1.15} opacity={0.85} />
        ))}
      </g>
    </svg>
  );
}

/* ---------- The spider itself ---------- */
function SpiderArt() {
  const legs = [
    "M-2.2 -0.6 C -8 -5 -13.5 -4.4 -16.5 1",
    "M-2.4 0.8 C -9.5 -0.4 -14.6 1.8 -16.8 7",
    "M-2.2 2.4 C -9 4.2 -12.6 7.4 -13.4 12",
    "M-1.4 3.6 C -6 7.6 -8.2 10.6 -8 15",
  ];
  return (
    <>
      {[1, -1].map((dir) => (
        <g key={dir} transform={dir === -1 ? "scale(-1,1)" : undefined}>
          <g className="cb-legs" style={{ animationDelay: dir === -1 ? "-0.9s" : "0s" }}>
            {legs.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
            ))}
          </g>
        </g>
      ))}
      <ellipse cx={0} cy={4.8} rx={4.7} ry={5.6} fill="currentColor" />
      <circle cx={0} cy={-1.4} r={3.2} fill="currentColor" />
      <path d="M0 2.6 L1.7 5 L0 7.2 L-1.7 5 Z" fill="var(--cb-red)" />
      <circle cx={-1.15} cy={-2.1} r={0.75} fill="var(--cb-eye)" />
      <circle cx={1.15} cy={-2.1} r={0.75} fill="var(--cb-eye)" />
    </>
  );
}

/**
 * A spider on a live thread. It hangs in a gutter, swings toward the
 * cursor when the cursor is nearby, hauls itself up if you get too
 * close, and sways on its own when the page has been still a while.
 */
function DanglingSpider({ restLength = 96, className }: { restLength?: number; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const threadRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const body = bodyRef.current;
    const thread = threadRef.current;
    if (!wrap || !body || !thread) return;

    const CX = 80;
    const SCALE = 1.45;
    const draw = (angle: number, len: number) => {
      const sx = CX + Math.sin(angle) * len;
      const sy = Math.cos(angle) * len;
      const qx = CX + Math.sin(angle) * len * 0.4;
      const qy = Math.cos(angle) * len * 0.53;
      thread.setAttribute("d", `M ${CX} 0 Q ${qx.toFixed(2)} ${qy.toFixed(2)} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
      body.setAttribute(
        "transform",
        `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${((angle * 180) / Math.PI).toFixed(2)}) scale(${SCALE})`
      );
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0, restLength);
      return;
    }

    let angle = 0;
    let angleV = 0;
    let len = restLength;
    let lenV = 0;
    let mx = -9999;
    let my = -9999;
    let tick = 0;
    let lastMove = -999;
    let raf = 0;

    // getBoundingClientRect forces layout, so cache the anchor and only
    // refresh it when the page actually moves.
    let anchorX = 0;
    let anchorY = 0;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      anchorX = r.left + r.width / 2;
      anchorY = r.top;
    };
    measure();

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      lastMove = tick;
    };

    const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

    const frame = () => {
      tick++;
      let targetAngle = 0;
      let targetLen = restLength;

      const dist = Math.hypot(mx - anchorX, my - anchorY);
      if (dist < 430) {
        const pull = 1 - dist / 430;
        targetAngle = clamp((mx - anchorX) / 250, -1, 1) * 0.4 * pull;
        if (dist < 130) targetLen = restLength - 42 * (1 - dist / 130);
      }
      // Idle for ~2.5s: breathe on its own so it never looks dead.
      if (tick - lastMove > 150) targetAngle += Math.sin(tick / 60) * 0.08;

      angleV += (targetAngle - angle) * 0.014;
      angleV *= 0.96;
      angle += angleV;

      lenV += (targetLen - len) * 0.02;
      lenV *= 0.86;
      len += lenV;

      draw(angle, len);
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [restLength]);

  return (
    <div ref={wrapRef} className={`cb-drop ${className ?? ""}`} aria-hidden="true">
      <svg viewBox={`0 0 160 ${restLength + 70}`} width={160} height={restLength + 70} overflow="visible">
        <path ref={threadRef} d={`M 80 0 L 80 ${restLength}`} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.75} />
        <g ref={bodyRef} transform={`translate(80 ${restLength}) scale(1.45)`}>
          <SpiderArt />
        </g>
      </svg>
    </div>
  );
}

/* ---------- The city, in one flat plate of ink ---------- */
function Skyline() {
  return (
    <svg className="cb-skyline" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M0 120 L0 74 L34 74 L34 58 L62 58 L62 82 L96 82 L96 44 L104 44 L104 28 L112 28 L112 44 L140 44 L140 66 L176 66 L176 52 L210 52 L210 88 L244 88 L244 40 L252 40 L252 20 L258 20 L258 40 L292 40 L292 70 L330 70 L330 56 L368 56 L368 84 L404 84 L404 46 L438 46 L438 32 L446 32 L446 46 L470 46 L470 76 L508 76 L508 60 L546 60 L546 80 L578 80 L578 66 L600 66 L600 120 Z"
      />
      {[
        [44, 66],
        [118, 54],
        [186, 62],
        [222, 60],
        [300, 80],
        [340, 66],
        [414, 56],
        [480, 86],
        [516, 70],
        [556, 90],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={4} height={5} fill="var(--cb-yellow)" opacity={0.55} />
      ))}
    </svg>
  );
}

/* ---------- Day marks for the week strip ---------- */
type DayState = "present" | "wfh" | "half" | "leave" | "rest" | "ahead";
function DayMark({ state }: { state: DayState }) {
  const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.4 } as const;
  return (
    <svg viewBox="0 0 26 26" width={26} height={26} aria-hidden="true">
      {state === "present" && <circle cx={13} cy={13} r={8} fill="currentColor" />}
      {state === "wfh" && (
        <>
          <circle cx={13} cy={13} r={8} {...S} />
          <circle cx={13} cy={13} r={2.7} fill="currentColor" />
        </>
      )}
      {state === "half" && (
        <>
          <circle cx={13} cy={13} r={8} {...S} />
          <path d="M13 5 A8 8 0 0 1 13 21 Z" fill="currentColor" />
        </>
      )}
      {state === "leave" && (
        <>
          <circle cx={13} cy={13} r={8} {...S} />
          <path d="M7.4 18.6 L18.6 7.4" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
      {state === "rest" && <path d="M6 13 H20" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />}
      {state === "ahead" && <circle cx={13} cy={13} r={8} {...S} strokeWidth={1.6} strokeDasharray="3 3.6" opacity={0.45} />}
    </svg>
  );
}

/* Two tiers of four: the four days already on the record, then today (still
   open), the two days that haven't happened, and the running streak. */
const WEEK: { day: string; state: DayState | "today" }[] = [
  { day: "Mon", state: "present" },
  { day: "Tue", state: "wfh" },
  { day: "Wed", state: "present" },
  { day: "Thu", state: "half" },
  { day: "Today", state: "today" },
  { day: "Sat", state: "ahead" },
  { day: "Sun", state: "rest" },
];

/* ---------- Feature marks ---------- */
const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconMark() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true" {...ICON}>
      <rect x={3} y={5} width={18} height={16} />
      <path d="M3 10 H21 M8 3 V6 M16 3 V6" />
      <path d="M8.5 15.5 L11 18 L16 13" />
    </svg>
  );
}
function IconLog() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true" {...ICON}>
      <path d="M5 3 H16 L19 6 V21 H5 Z" />
      <path d="M8.5 10 H15.5 M8.5 14 H15.5 M8.5 18 H12.5" />
    </svg>
  );
}
function IconWeek() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true" {...ICON}>
      <path d="M4 20 H21" />
      <path d="M6.5 20 V13 M11 20 V8 M15.5 20 V15 M20 20 V4" />
    </svg>
  );
}
function IconStreak() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true" {...ICON}>
      <path d="M12 3 C16 7.6 18 10.4 18 13.5 A6 6 0 0 1 6 13.5 C6 11.4 7.2 9.6 9 8" />
      <path d="M12 20 A2.8 2.8 0 0 1 12 14.4 A2.8 2.8 0 0 1 12 20 Z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <IconMark />,
    title: "Mark the day",
    body: "Present, work from home, half day, or leave. One tap and the day is on the record — including days you forgot, which you can still fill in.",
  },
  {
    icon: <IconLog />,
    title: "Log the work",
    body: "What you did, who it was for, and where it stands. Done, in progress, blocked, waiting on someone else.",
  },
  {
    icon: <IconWeek />,
    title: "Read the week",
    body: "Weekly and monthly digests assembled from what you already logged. Nothing extra to fill in at the end of the month.",
  },
  {
    icon: <IconStreak />,
    title: "Keep the streak",
    body: "Sundays don't break it. Badges show up when you've genuinely earned them, and not one minute before.",
  },
];

const AUDIENCE = ["Employees", "Interns", "Students", "Freelancers", "Yet to be employed"];

/* ============================================================ */

export default function Landing() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [inked, setInked] = useState(false);
  const [quote, setQuote] = useState("It's not about the mask. It's about what you do while wearing it.");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const saved = (localStorage.getItem("stride-theme") || "light") as "light" | "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    setQuote(getQuote("landing"));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("stride-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  // Panels ink in as they come into view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".cb-rise"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="cb-page">
      {/* ============ MASTHEAD ============ */}
      <header className="cb-masthead">
        <div className="cb-shell cb-masthead-in">
          <div className="cb-brand">
            <span className="cb-wordmark">Stride</span>
            <span className="cb-pricebox">Free</span>
          </div>

          <div className="cb-masthead-actions">
            <button type="button" onClick={toggleTheme} className="cb-icon-btn" aria-label={theme === "light" ? "Switch to night edition" : "Switch to day edition"}>
              {theme === "light" ? (
                <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" {...ICON}>
                  <path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A6.8 6.8 0 0 0 20 14.5 Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" {...ICON}>
                  <circle cx={12} cy={12} r={4.2} />
                  <path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M18.7 5.3 L17 7 M7 17 L5.3 18.7" />
                </svg>
              )}
              <span>{theme === "light" ? "Night" : "Day"}</span>
            </button>
            <Link href="/login" className="cb-btn cb-btn-quiet">Log in</Link>
            <Link href="/signup" className="cb-btn cb-btn-ink">Start tracking</Link>
          </div>
        </div>
        <div className="cb-rule-strip">
          <div className="cb-shell cb-strip-in">
            <span>Vol. 1 — No. 1</span>
            <span className="cb-strip-tag">Your friendly neighborhood tracker</span>
            <span>Attendance · Work log · Streaks</span>
          </div>
        </div>
      </header>

      <main>
        {/* ============ HERO: two panels, one gutter ============ */}
        <section className="cb-shell cb-band cb-hero">
          <div className="cb-pnl cb-pnl-lead">
            <span className="cb-halftone" aria-hidden="true" />
            <div className="cb-caption">Every day you show up is a day worth counting.</div>

            <h1 className="cb-h1">
              <span className="cb-ghost cb-ghost-c" aria-hidden="true">
                Your day,<br />on the<br />record.
              </span>
              <span className="cb-ghost cb-ghost-m" aria-hidden="true">
                Your day,<br />on the<br />record.
              </span>
              <span className="cb-h1-ink">
                Your day,<br />on the<br />record.
              </span>
            </h1>

            <p className="cb-lead">
              Stride keeps a private, honest record of your working life — whether you show up, what you worked on, and how
              long you&apos;ve kept it going. It takes about fifteen seconds a day.
            </p>

            <div className="cb-cta-row">
              <Link href="/signup" className="cb-btn cb-btn-hero">Create free account</Link>
              <a href="#inside" className="cb-btn cb-btn-quiet">See what&apos;s inside</a>
            </div>
            <p className="cb-fine">No card, no trial clock. Open source if you&apos;d rather run it yourself.</p>
          </div>

          <div className="cb-pnl cb-pnl-action">
            <span className="cb-halftone cb-halftone-dusk" aria-hidden="true" />
            <WebCorner size={300} />
            <DanglingSpider restLength={104} className="cb-drop-hero" />

            <p className="cb-panel-label">One week, as it actually looks</p>

            <div className="cb-week">
              {WEEK.map((d) =>
                d.state === "today" ? (
                  <button
                    key={d.day}
                    type="button"
                    className={`cb-cell cb-cell-today ${inked ? "is-inked" : ""}`}
                    onClick={() => setInked(true)}
                    aria-pressed={inked}
                  >
                    <span className="cb-cell-day">{d.day}</span>
                    {inked ? <DayMark state="present" /> : <span className="cb-tap">Tap</span>}
                  </button>
                ) : (
                  <div key={d.day} className={`cb-cell cb-cell-${d.state}`}>
                    <span className="cb-cell-day">{d.day}</span>
                    <DayMark state={d.state} />
                  </div>
                )
              )}

              <div className="cb-cell cb-cell-streak">
                <span className="cb-cell-day">Streak</span>
                <strong aria-live="polite">{inked ? 12 : 11}</strong>
              </div>
            </div>

            <p className="cb-panel-note">
              {inked
                ? "Recorded. Tomorrow it asks again — that's the entire habit."
                : "Tap today to see how a day gets recorded."}
            </p>
          </div>
        </section>

        {/* ============ WHAT'S INSIDE ============ */}
        <section id="inside" className="cb-shell cb-band">
          <div className="cb-head cb-rise">
            <span className="cb-tab">What&apos;s inside</span>
            <h2 className="cb-h2">Four screens. That&apos;s the whole product.</h2>
          </div>

          <div className="cb-grid-4">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="cb-pnl cb-pnl-feat cb-rise" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="cb-feat-icon">{f.icon}</span>
                <h3 className="cb-h3">{f.title}</h3>
                <p className="cb-body">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============ WHO IT'S FOR — the night panel ============ */}
        <section className="cb-shell cb-band">
          <div className="cb-night-wrap">
            <DanglingSpider restLength={78} className="cb-drop-night" />
            <div className="cb-pnl cb-pnl-night cb-rise">
              <span className="cb-halftone cb-halftone-night" aria-hidden="true" />
              <Skyline />
              <div className="cb-night-in">
                <span className="cb-tab cb-tab-invert">Anyone can wear the mask</span>
                <h2 className="cb-h2 cb-h2-invert">You don&apos;t need a job to have a day worth tracking.</h2>
                <ul className="cb-chips">
                  {AUDIENCE.map((a) => (
                    <li key={a} className="cb-chip">{a}</li>
                  ))}
                </ul>
                <p className="cb-body cb-body-invert">
                  &ldquo;Yet to be employed&rdquo; is a real option in the sign-up form, not a joke. Studying, job hunting, building
                  something nobody&apos;s paying for yet — it all counts as a day, and it all deserves a record.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="cb-shell cb-band">
          <div className="cb-pnl cb-pnl-cta cb-rise">
            <span className="cb-halftone cb-halftone-cta" aria-hidden="true" />
            <WebCorner size={140} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <h2 className="cb-h2 cb-h2-cta">Start with today.</h2>
              <p className="cb-body cb-body-cta">
                Sign up, mark how today went, and come back tomorrow. The record builds itself from there.
              </p>
            </div>
            <div className="cb-cta-row" style={{ position: 'relative', zIndex: 2 }}>
              <Link href="/signup" className="cb-btn cb-btn-ink cb-btn-lg">Create free account</Link>
              <Link href="/login" className="cb-btn cb-btn-onyellow">I already have one</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="cb-footer">
        <div className="cb-shell cb-footer-in">
          <div>
            <span className="cb-wordmark cb-wordmark-sm">Stride</span>
            <p className="cb-footer-tag">Your friendly neighborhood tracker.</p>
          </div>
          <nav className="cb-footer-nav" aria-label="Footer">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Create account</Link>
            {SOURCE_URL && <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source</a>}
          </nav>
          <div className="cb-quote-wrap">
            <p className="cb-quote">{quote}</p>
          </div>
        </div>
        <div className="cb-colophon">
          <div className="cb-shell">
            Stride is an independent personal tracker. Not affiliated with, endorsed by, or licensed from Marvel. All
            artwork on this page is original.
          </div>
        </div>
      </footer>

      <style>{`
        /* ===== LANDING TOKENS — a four-colour press on pulp paper ===== */
        .cb-page {
          --cb-pulp:    #e2dbc9;
          --cb-panel:   #f4efe2;
          --cb-line:    #16120f;
          --cb-text:    #16120f;
          --cb-muted:   #5d564c;
          --cb-cyan:    #12a5d4;
          --cb-magenta: #e5266d;
          --cb-red:     #d6202a;
          --cb-yellow:  #ffd831;
          --cb-night:   #16131d;
          --cb-eye:     #f4efe2;
          --cb-blend:   multiply;

          background: var(--cb-pulp);
          color: var(--cb-text);
          min-height: 100vh;
          font-family: "Inter", system-ui, sans-serif;
          overflow-x: hidden;
        }
        [data-theme="dark"] .cb-page {
          --cb-pulp:    #100e15;
          --cb-panel:   #1a1822;
          --cb-line:    #6a6478;
          --cb-text:    #ece6d9;
          --cb-muted:   #9a93a6;
          --cb-night:   #08070c;
          --cb-eye:     #1a1822;
          --cb-blend:   screen;
        }

        .cb-shell { width: 100%; max-width: 1140px; margin: 0 auto; padding: 0 18px; }
        .cb-band  { padding: 34px 18px; }

        /* ===== MASTHEAD ===== */
        .cb-masthead {
          position: sticky; top: 0; z-index: 30;
          background: var(--cb-pulp);
          border-bottom: 2.5px solid var(--cb-line);
        }
        .cb-masthead-in {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; padding-top: 12px; padding-bottom: 12px;
        }
        .cb-brand { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
        .cb-wordmark {
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 900;
          font-size: 2.1rem; line-height: .82; letter-spacing: .012em;
          color: var(--cb-text);
        }
        .cb-wordmark-sm { font-size: 1.6rem; }
        .cb-pricebox {
          font-family: "IBM Plex Mono", monospace;
          font-size: .58rem; font-weight: 500; text-transform: uppercase; letter-spacing: .14em;
          border: 2px solid var(--cb-line); padding: 2px 6px;
          background: var(--cb-yellow); color: #16120f;
          transform: rotate(-3deg);
        }
        .cb-masthead-actions { display: flex; align-items: center; gap: 8px; }

        /* ===== THE DOUBLE RULE UNDER A MASTHEAD ===== */
        .cb-rule-strip {
          border-top: 1px solid var(--cb-line);
          background: var(--cb-panel);
        }
        .cb-strip-in {
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding-top: 5px; padding-bottom: 5px;
          font-family: "IBM Plex Mono", monospace;
          font-size: .62rem; letter-spacing: .1em; text-transform: uppercase;
          color: var(--cb-muted);
        }
        .cb-strip-tag { color: var(--cb-text); font-weight: 500; }

        /* ===== BUTTONS ===== */
        .cb-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          border: 2.5px solid var(--cb-line);
          padding: .5rem 1rem; border-radius: 0;
          font-size: .74rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: .07em;
          text-decoration: none; cursor: pointer; white-space: nowrap;
          box-shadow: 3px 3px 0 0 var(--cb-line);
          transition: transform .1s ease, box-shadow .1s ease;
        }
        .cb-btn:hover  { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 0 var(--cb-line); }
        .cb-btn:active { transform: translate(3px,3px);   box-shadow: none; }
        .cb-btn-ink      { background: var(--cb-red);   color: #fff; }
        .cb-btn-quiet    { background: var(--cb-panel); color: var(--cb-text); }
        .cb-btn-hero     { background: var(--cb-yellow); color: #16120f; padding: .68rem 1.4rem; font-size: .82rem; }
        .cb-btn-onyellow { background: var(--cb-panel); color: var(--cb-text); }
        .cb-btn-lg       { padding: .68rem 1.4rem; font-size: .82rem; }

        .cb-icon-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--cb-panel); color: var(--cb-text);
          border: 2.5px solid var(--cb-line); border-radius: 0;
          padding: .42rem .62rem; cursor: pointer;
          font-family: "IBM Plex Mono", monospace;
          font-size: .6rem; text-transform: uppercase; letter-spacing: .1em;
          box-shadow: 3px 3px 0 0 var(--cb-line);
          transition: transform .1s ease, box-shadow .1s ease;
        }
        .cb-icon-btn:hover  { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 0 var(--cb-line); }
        .cb-icon-btn:active { transform: translate(3px,3px); box-shadow: none; }

        .cb-page a:focus-visible,
        .cb-page button:focus-visible {
          outline: 3px solid var(--cb-magenta);
          outline-offset: 2px;
        }

        /* ===== PANELS ===== */
        .cb-pnl {
          position: relative;
          background: var(--cb-panel);
          border: 2.5px solid var(--cb-line);
          box-shadow: 5px 5px 0 0 var(--cb-line);
          padding: 26px;
          overflow: hidden;
        }

        /* Ben-Day dots, two plates offset into a rosette */
        .cb-halftone {
          position: absolute; inset: 0; pointer-events: none;
          color: var(--cb-line); opacity: .09;
          background-image:
            radial-gradient(currentColor 1px, transparent 1.15px),
            radial-gradient(currentColor 1px, transparent 1.15px);
          background-size: 6px 6px, 6px 6px;
          background-position: 0 0, 3px 3px;
        }
        .cb-halftone-dusk {
          color: var(--cb-cyan); opacity: .3;
          -webkit-mask-image: linear-gradient(200deg, #000 0%, transparent 72%);
                  mask-image: linear-gradient(200deg, #000 0%, transparent 72%);
        }
        .cb-halftone-night { color: var(--cb-cyan); opacity: .18; }

        /* ===== HERO ===== */
        .cb-hero {
          display: grid;
          grid-template-columns: minmax(0,1.12fr) minmax(0,.88fr);
          gap: 14px;
          align-items: stretch;
          padding-top: 42px;
        }
        .cb-pnl-lead { display: flex; flex-direction: column; gap: 16px; padding: 30px; }

        .cb-caption {
          align-self: flex-start;
          background: var(--cb-yellow); color: #16120f;
          border: 2.5px solid var(--cb-line);
          padding: 7px 11px; max-width: 30ch;
          font-size: .76rem; font-weight: 700; line-height: 1.35;
        }

        .cb-h1 { position: relative; margin: 0; }
        .cb-h1 .cb-ghost, .cb-h1 .cb-h1-ink {
          display: block;
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 900;
          font-size: clamp(3.1rem, 8vw, 5.5rem);
          line-height: .84; letter-spacing: .012em;
        }
        /* Plates that don't quite line up — the signature of cheap colour printing */
        .cb-ghost {
          position: absolute; inset: 0; pointer-events: none;
          mix-blend-mode: var(--cb-blend);
        }
        .cb-ghost-c { color: var(--cb-cyan);    transform: translate(-3px,-2px); opacity: .55; }
        .cb-ghost-m { color: var(--cb-magenta); transform: translate(3px, 2px);  opacity: .45; }
        .cb-h1-ink  { position: relative; color: var(--cb-text); }
        [data-theme="dark"] .cb-ghost-c { opacity: .5; }
        [data-theme="dark"] .cb-ghost-m { opacity: .44; }

        .cb-lead { margin: 0; font-size: 1rem; line-height: 1.62; color: var(--cb-muted); max-width: 46ch; }
        .cb-cta-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .cb-fine {
          margin: 0; font-family: "IBM Plex Mono", monospace;
          font-size: .66rem; color: var(--cb-muted); letter-spacing: .03em;
        }

        /* ===== ACTION PANEL: a week told as a strip ===== */
        .cb-pnl-action {
          display: flex; flex-direction: column; gap: 14px;
          /* Dusk sky washing down into paper — this panel is a scene, not a card. */
          background:
            linear-gradient(179deg,
              rgba(18,165,212,.20) 0%,
              rgba(18,165,212,.07) 32%,
              rgba(214,32,42,.045) 50%,
              transparent 64%),
            var(--cb-panel);
          padding: 26px 24px;
        }
        [data-theme="dark"] .cb-pnl-action {
          background:
            linear-gradient(179deg,
              rgba(18,165,212,.16) 0%,
              rgba(18,165,212,.05) 34%,
              transparent 60%),
            var(--cb-panel);
        }
        .cb-web {
          position: absolute; top: -2px; right: -2px;
          color: var(--cb-line); opacity: .34; pointer-events: none;
        }
        [data-theme="dark"] .cb-web { opacity: .46; }

        .cb-panel-label, .cb-panel-note {
          position: relative; margin: 0;
          font-family: "IBM Plex Mono", monospace;
          font-size: .63rem; letter-spacing: .09em; text-transform: uppercase;
          color: var(--cb-muted);
        }
        .cb-panel-note { text-transform: none; letter-spacing: .01em; font-size: .68rem; min-height: 2.1em; }

        .cb-week {
          position: relative;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 7px; margin-top: auto;
        }
        .cb-cell {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
          aspect-ratio: 1 / .82;
          border: 2px solid var(--cb-line);
          background: var(--cb-panel);
          color: var(--cb-text);
        }
        .cb-cell-day {
          font-family: "IBM Plex Mono", monospace;
          font-size: .56rem; letter-spacing: .1em; text-transform: uppercase;
          color: var(--cb-muted);
        }
        .cb-cell-ahead { color: var(--cb-muted); }
        .cb-cell-rest  { background: var(--cb-pulp); color: var(--cb-muted); }
        .cb-cell-streak { background: var(--cb-line); color: var(--cb-panel); }
        .cb-cell-streak .cb-cell-day { color: var(--cb-panel); opacity: .7; }
        /* At night the loudest surface is the cream plate, not the line colour —
           --cb-line goes muted lavender in dark, which is the one thing the
           payoff number must not be. */
        [data-theme="dark"] .cb-cell-streak {
          background: var(--cb-text); border-color: var(--cb-text); color: var(--cb-pulp);
        }
        [data-theme="dark"] .cb-cell-streak .cb-cell-day { color: var(--cb-pulp); }
        .cb-cell-streak strong {
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          font-size: 1.9rem; line-height: .8; font-weight: 900;
        }
        .cb-cell-today {
          background: var(--cb-yellow); color: #16120f;
          border-width: 2.5px; cursor: pointer;
          box-shadow: inset 0 0 0 2px var(--cb-panel);
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .cb-cell-today .cb-cell-day { color: #16120f; opacity: .65; }
        .cb-cell-today:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 2px var(--cb-panel), 0 3px 0 0 var(--cb-line); }
        .cb-cell-today.is-inked {
          box-shadow: none; cursor: default;
          animation: cbStamp .35s cubic-bezier(.22,.68,0,1.4) both;
        }
        @keyframes cbStamp {
          0%   { transform: scale(1.18) rotate(-4deg); }
          50%  { transform: scale(.95) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .cb-tap {
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 900; font-size: 1.15rem; line-height: 1;
        }

        /* ===== SPIDERS ===== */
        /* Zero-width wrapper: the left/right value IS the thread's x
           position, so the spider can be aimed at a gutter precisely. */
        .cb-drop { position: absolute; width: 0; z-index: 12; color: var(--cb-line); pointer-events: none; overflow: visible; }
        .cb-drop svg { display: block; margin-left: -80px; }
        [data-theme="dark"] .cb-drop { color: #b9b2c6; }
        .cb-drop-hero  { top: -2px; left: 50%; }
        /* This one hangs over the night panel, so it has to be lit from the front.
           Cream-on-dark gives strong contrast in both themes. The red diamond
           and eye dots are overridden so they read against the light body. */
        .cb-drop-night { top: -14px; right: 14%; color: #ded7c7; --cb-red: #d6202a; --cb-eye: #16131d; }
        [data-theme="dark"] .cb-drop-night { color: #e8e1d3; --cb-red: #e5266d; --cb-eye: #08070c; }
        .cb-legs { animation: cbTwitch 2.6s ease-in-out infinite; transform-origin: 0 2px; }
        @keyframes cbTwitch {
          0%, 100% { transform: rotate(0deg); }
          40%      { transform: rotate(2.4deg); }
          70%      { transform: rotate(-1.6deg); }
        }

        /* ===== SECTION HEADS ===== */
        .cb-head { margin-bottom: 16px; }
        .cb-tab {
          display: inline-block;
          background: var(--cb-line); color: var(--cb-panel);
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 700;
          font-size: .82rem; letter-spacing: .16em;
          padding: 3px 10px 2px; margin-bottom: 9px;
        }
        .cb-tab-invert { background: var(--cb-yellow); color: #16120f; }
        .cb-h2 {
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 900;
          font-size: clamp(1.7rem, 3.4vw, 2.5rem);
          line-height: .94; letter-spacing: .014em;
          margin: 0; max-width: 26ch; color: var(--cb-text);
        }
        .cb-h2-invert { color: #f4efe2; max-width: 24ch; }
        .cb-h2-cta { color: #16120f; }

        /* ===== FEATURE PANELS ===== */
        .cb-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .cb-pnl-feat {
          display: flex; flex-direction: column; gap: 9px; padding: 22px 20px;
          transition: transform .14s ease, box-shadow .14s ease;
        }
        .cb-pnl-feat:hover {
          transform: translateY(-3px);
          box-shadow: 7px 7px 0 0 var(--cb-line);
        }
        .cb-pnl-feat:active {
          transform: translateY(1px);
          box-shadow: 3px 3px 0 0 var(--cb-line);
        }
        .cb-feat-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; flex-shrink: 0;
          border: 2.5px solid var(--cb-line);
          background: var(--cb-yellow); color: #16120f;
          margin-bottom: 3px;
          transition: transform .14s ease;
        }
        .cb-pnl-feat:hover .cb-feat-icon {
          transform: rotate(-6deg) scale(1.08);
        }
        .cb-h3 {
          font-family: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
          text-transform: uppercase; font-weight: 900;
          font-size: 1.32rem; line-height: 1; letter-spacing: .015em;
          margin: 0; color: var(--cb-text);
        }
        .cb-body { margin: 0; font-size: .84rem; line-height: 1.6; color: var(--cb-muted); }
        .cb-body-invert { color: #bdb6a8; max-width: 62ch; }
        .cb-body-cta { color: #3d3428; max-width: 48ch; font-size: .9rem; }

        /* ===== NIGHT PANEL ===== */
        .cb-night-wrap { position: relative; }
        .cb-pnl-night { background: var(--cb-night); padding: 0; border-color: var(--cb-line); }
        .cb-night-in { position: relative; z-index: 2; padding: 34px 30px 96px; }
        .cb-skyline {
          position: absolute; bottom: -1px; left: 0; right: 0;
          width: 100%; height: 118px;
          color: #000; opacity: .82; z-index: 1; pointer-events: none;
        }
        [data-theme="dark"] .cb-skyline { color: #000; opacity: 1; }
        .cb-chips { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 16px 0 16px; }
        .cb-chip {
          border: 2px solid #f4efe2; color: #f4efe2;
          padding: 4px 11px; font-size: .74rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: .05em;
        }
        .cb-chip:last-child { background: var(--cb-yellow); color: #16120f; border-color: var(--cb-yellow); }

        /* ===== CTA PANEL ===== */
        .cb-pnl-cta {
          background: var(--cb-yellow);
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 22px; padding: 32px 30px;
          position: relative; overflow: hidden;
        }
        .cb-halftone-cta {
          color: var(--cb-red); opacity: .06;
          -webkit-mask-image: linear-gradient(135deg, transparent 40%, #000 100%);
                  mask-image: linear-gradient(135deg, transparent 40%, #000 100%);
        }
        .cb-pnl-cta .cb-web {
          width: 140px; height: 140px;
          color: var(--cb-red); opacity: .18;
        }

        /* ===== FOOTER ===== */
        .cb-footer { border-top: 2.5px solid var(--cb-line); background: var(--cb-panel); margin-top: 20px; }
        .cb-footer-in {
          display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between;
          gap: 22px; padding-top: 28px; padding-bottom: 24px;
        }
        .cb-footer-tag { margin: 4px 0 0; font-size: .78rem; color: var(--cb-muted); }
        .cb-footer-nav { display: flex; flex-wrap: wrap; gap: 18px; }
        .cb-footer-nav a {
          color: var(--cb-text); text-decoration: none;
          font-size: .78rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: .07em;
          border-bottom: 2px solid transparent;
          transition: border-color .12s ease;
        }
        .cb-footer-nav a:hover { border-bottom-color: var(--cb-red); }
        /* Speech-tail quote bubble — the tail points left toward the
           footer wordmark, like a quip from the spider. */
        .cb-quote-wrap {
          position: relative;
          background: var(--cb-pulp);
          border: 2px solid var(--cb-line);
          padding: 12px 14px;
          max-width: 30ch;
        }
        .cb-quote-wrap::before {
          content: '';
          position: absolute; left: -10px; top: 14px;
          width: 0; height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 10px solid var(--cb-line);
        }
        .cb-quote-wrap::after {
          content: '';
          position: absolute; left: -7px; top: 14px;
          width: 0; height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 10px solid var(--cb-pulp);
        }
        .cb-quote {
          margin: 0;
          font-family: "IBM Plex Mono", monospace; font-style: italic;
          font-size: .72rem; line-height: 1.5; color: var(--cb-muted);
        }
        .cb-colophon {
          border-top: 1px solid var(--cb-line);
          background: var(--cb-pulp);
          padding: 9px 0;
          font-family: "IBM Plex Mono", monospace;
          font-size: .6rem; letter-spacing: .03em; color: var(--cb-muted);
        }

        /* ===== MOTION ===== */
        .cb-rise { opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .5s ease; }
        .cb-rise.is-in { opacity: 1; transform: none; }
        .cb-hero .cb-pnl { animation: cbInk .55s ease both; }
        .cb-hero .cb-pnl-action { animation-delay: .12s; }
        @keyframes cbInk { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .cb-page *, .cb-page *::before, .cb-page *::after {
            animation: none !important;
            transition: none !important;
          }
          .cb-rise { opacity: 1; transform: none; }
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1000px) {
          .cb-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 900px) {
          .cb-hero { grid-template-columns: 1fr; padding-top: 30px; }
          /* Stacked, the panel is short and the grid would sit right under the
             label — open a band of sky so the web and the spider have somewhere
             to be, instead of hanging over a day cell. */
          .cb-week { margin-top: 76px; }
          .cb-pnl-cta { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 720px) {
          .cb-band { padding: 26px 14px; }
          .cb-shell { padding: 0 14px; }
          .cb-strip-in { justify-content: center; }
          .cb-strip-in span:first-child, .cb-strip-in span:last-child { display: none; }
          .cb-pnl { padding: 22px 18px; }
          .cb-pnl-lead { padding: 24px 18px; }
          .cb-night-in { padding: 26px 20px 84px; }
          .cb-footer-in { flex-direction: column; }
          .cb-quote-wrap { max-width: none; }
          .cb-quote-wrap::before, .cb-quote-wrap::after { display: none; }
        }
        @media (max-width: 560px) {
          .cb-wordmark { font-size: 1.7rem; }
          .cb-pricebox { display: none; }
          .cb-masthead-actions .cb-icon-btn span { display: none; }
          .cb-btn { padding: .46rem .76rem; font-size: .68rem; }
          .cb-h1 .cb-ghost, .cb-h1 .cb-h1-ink { font-size: clamp(2.6rem, 13vw, 3.4rem); }
          .cb-caption { max-width: none; }
          .cb-week { gap: 5px; }
          .cb-cell { aspect-ratio: 1 / .9; }
          .cb-cell-day { font-size: .5rem; }
          .cb-cell-streak strong { font-size: 1.3rem; }
          .cb-pnl-cta { padding: 26px 20px; }
          /* Disable hover lift on touch — the :active already gives feedback */
          .cb-pnl-feat:hover { transform: none; box-shadow: 5px 5px 0 0 var(--cb-line); }
          .cb-pnl-feat:hover .cb-feat-icon { transform: none; }
        }
      `}</style>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { employmentLabel } from "@/lib/utils";
import { useState, useEffect } from "react";

interface Profile {
  id: string; full_name: string; email: string;
  role: string; employment_type: string | null; start_date: string | null;
}

/* ---------- SVG stroke icons — same weight as Landing's ICON set ---------- */
const I = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconToday() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <rect x={3} y={5} width={18} height={16} />
      <path d="M3 10 H21 M8 3 V6 M16 3 V6" />
      <path d="M8.5 15.5 L11 18 L16 13" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <path d="M12 8 V12 L15 15" />
      <circle cx={12} cy={12} r={9} />
    </svg>
  );
}
function IconAchievements() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <path d="M6 9 A6 6 0 0 0 18 9 V3 H6 Z" />
      <path d="M12 15 V19 M8 21 H16" />
      <path d="M6 7 C4 7 2 8 2 10 C2 12 4 13 6 12" />
      <path d="M18 7 C20 7 22 8 22 10 C22 12 20 13 18 12" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <circle cx={12} cy={12} r={3} />
      <path d="M12 1 V4 M12 20 V23 M4.22 4.22 L6.34 6.34 M17.66 17.66 L19.78 19.78 M1 12 H4 M20 12 H23 M4.22 19.78 L6.34 17.66 M17.66 6.34 L19.78 4.22" />
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <path d="M4 20 H21" />
      <path d="M6.5 20 V13 M11 20 V8 M15.5 20 V15 M20 20 V4" />
    </svg>
  );
}
function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <circle cx={9} cy={7} r={3} />
      <path d="M3 21 V18 A4 4 0 0 1 7 14 H11 A4 4 0 0 1 15 18 V21" />
      <circle cx={17} cy={9} r={2.5} />
      <path d="M17 14 H19 A3 3 0 0 1 22 17 V21" />
    </svg>
  );
}
function IconReport() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <path d="M5 3 H16 L19 6 V21 H5 Z" />
      <path d="M8.5 10 H15.5 M8.5 14 H15.5 M8.5 18 H12.5" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" {...I}>
      <path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A6.8 6.8 0 0 0 20 14.5 Z" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" {...I}>
      <circle cx={12} cy={12} r={4.2} />
      <path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M18.7 5.3 L17 7 M7 17 L5.3 18.7" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" {...I}>
      <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
    </svg>
  );
}

export default function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // The sidebar date is read after mount. During SSR the server is on
  // UTC and the browser is on IST, so rendering it inline hands React
  // two different strings to hydrate — and past 18:30 UTC they're
  // different days, not just different formatting.
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const saved = (localStorage.getItem("stride-theme") || "light") as "light" | "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    setTodayLabel(
      new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    );
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("stride-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Close the mobile drawer on navigation — otherwise tapping a link
  // leaves the sidebar and its scrim covering the page you asked for.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = (href: string) => pathname === href || (href !== "/today" && pathname.startsWith(href));

  const navLinks = [
    { href: "/today", label: "Today", icon: <IconToday /> },
    { href: "/history", label: "History", icon: <IconHistory /> },
    { href: "/achievements", label: "Achievements", icon: <IconAchievements /> },
    { href: "/settings", label: "Settings", icon: <IconSettings /> },
  ];

  const adminLinks = profile.role === "ADMIN" ? [
    { href: "/admin", label: "Team Dashboard", icon: <IconDashboard /> },
    { href: "/admin/employees", label: "Employees", icon: <IconTeam /> },
    { href: "/admin/report", label: "Report", icon: <IconReport /> },
  ] : [];

  const initials = profile.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay — a real button, so Escape-less keyboard users
          and screen readers can dismiss the drawer too. */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40, border: "none", padding: 0, cursor: "pointer" }}
        />
      )}

      {/* Sidebar */}
      <aside id="app-sidebar" style={{
        width: 230, flexShrink: 0, background: "var(--surface)", borderRight: "2.5px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "1.5rem 0.875rem", gap: "0.25rem",
        position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50,
        transform: menuOpen ? "translateX(0)" : undefined,
        transition: "transform 0.25s ease, background 0.2s, border-color 0.2s",
      }}
      className="sidebar">
        {/* Wordmark — Big Shoulders Display, matching Landing */}
        <div style={{ padding: "0 0.5rem 1.5rem", borderBottom: "2.5px solid var(--border)", marginBottom: "1rem" }}>
          <span style={{
            fontFamily: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif',
            textTransform: "uppercase", fontWeight: 900,
            fontSize: "1.8rem", lineHeight: .82, letterSpacing: ".012em",
            color: "var(--text)",
          }}>Stride</span>
          <div className="font-mono" style={{ fontSize: "0.58rem", color: "var(--text-muted)", marginTop: "0.35rem", letterSpacing: ".1em", textTransform: "uppercase" }}>
            Your friendly neighborhood tracker
          </div>
          <div className="font-mono" style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.15rem", opacity: .7, minHeight: "1em" }}>
            {todayLabel}
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? "active" : ""}`}>
              <span style={{ lineHeight: 0 }}>{l.icon}</span>
              {l.label}
            </Link>
          ))}

          {adminLinks.length > 0 && (
            <>
              <div style={{ padding: "0.85rem 0.75rem 0.35rem", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                Admin
              </div>
              {adminLinks.map(l => (
                <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? "active" : ""}`}>
                  <span style={{ lineHeight: 0 }}>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User profile + Theme toggle */}
        <div style={{ borderTop: "2.5px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.25rem", marginBottom: "0.25rem" }}>
            {/* Square avatar — no rounded corners */}
            <div style={{
              width: 32, height: 32,
              background: "var(--accent)", border: "2.5px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", fontWeight: 800, color: "#16120f", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.full_name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {profile.role === "ADMIN" ? "Admin" : employmentLabel(profile.employment_type)}
              </div>
            </div>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            <span style={{ lineHeight: 0 }}>{theme === "light" ? <IconMoon /> : <IconSun />}</span>
            {theme === "light" ? "Night Edition" : "Day Edition"}
          </button>
          <button onClick={signOut} disabled={signingOut} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.78rem", padding: "0.4rem" }}>
            {signingOut ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header style={{ display: "none" }} className="mobile-header">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="btn btn-ghost"
          style={{ padding: "0.4rem 0.6rem", lineHeight: 0 }}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <IconMenu />
        </button>
        <span style={{
          fontFamily: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif',
          textTransform: "uppercase", fontWeight: 900,
          fontSize: "1.3rem", color: "var(--text)",
        }}>Stride</span>
        <button
          onClick={toggleTheme}
          className="btn btn-ghost"
          style={{ padding: "0.4rem 0.6rem", lineHeight: 0 }}
          aria-label={theme === "light" ? "Switch to night edition" : "Switch to day edition"}
        >
          {theme === "light" ? <IconMoon /> : <IconSun />}
        </button>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 230, padding: "2rem", maxWidth: "100%", overflowX: "hidden" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          main { margin-left: 0 !important; padding: 1rem !important; padding-top: 4.5rem !important; }
          .mobile-header {
            display: flex !important; align-items: center; justify-content: space-between;
            position: fixed; top: 0; left: 0; right: 0; height: 56px;
            background: var(--surface); border-bottom: 2.5px solid var(--border);
            padding: 0 1rem; z-index: 30;
          }
        }
      `}</style>
    </div>
  );
}
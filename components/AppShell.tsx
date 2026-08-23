"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";

interface Profile {
  id: string; full_name: string; email: string;
  role: string; employment_type: string | null; start_date: string | null;
}

export default function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("stride-theme") || "light") as "light" | "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
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

  // Spidey web-click burst effect
  const spideyClick = useCallback((e: MouseEvent) => {
    const container = document.createElement("div");
    container.className = "web-burst";
    container.style.left = e.clientX + "px";
    container.style.top = e.clientY + "px";
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    angles.forEach(deg => {
      const strand = document.createElement("div");
      strand.className = "web-strand";
      strand.style.setProperty("--strand-rot", `rotate(${deg}deg)`);
      container.appendChild(strand);
    });
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 400);
  }, []);

  useEffect(() => {
    document.addEventListener("click", spideyClick);
    return () => document.removeEventListener("click", spideyClick);
  }, [spideyClick]);

  const isActive = (href: string) => pathname === href || (href !== "/today" && pathname.startsWith(href));

  const navLinks = [
    { href: "/today", label: "Today", icon: "\u{1F4CB}" },
    { href: "/history", label: "History", icon: "\u{1F4C5}" },
    { href: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
  ];

  const adminLinks = profile.role === "ADMIN" ? [
    { href: "/admin", label: "Team Dashboard", icon: "\u{1F4CA}" },
    { href: "/admin/employees", label: "Employees", icon: "\u{1F465}" },
    { href: "/admin/report", label: "Report", icon: "\u{1F4C8}" },
  ] : [];

  const initials = profile.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 230, flexShrink: 0, background: "var(--surface)", borderRight: "2px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "1.5rem 0.875rem", gap: "0.25rem",
        position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50,
        transform: menuOpen ? "translateX(0)" : undefined,
        transition: "transform 0.25s ease, background 0.2s, border-color 0.2s",
      }}
      className="sidebar">
        {/* Wordmark */}
        <div style={{ padding: "0 0.5rem 1.5rem", borderBottom: "2px solid var(--border)", marginBottom: "1rem" }}>
          <span className="font-title" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Stride</span>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.2rem", fontWeight: 600, letterSpacing: ".02em" }}>
            🕸️ Your Friendly Neighborhood Tracker
          </div>
          <div className="font-mono" style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "0.15rem", opacity: .7 }}>
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? "active" : ""}`}>
              <span style={{ fontSize: "1rem", lineHeight: 1 }}>{l.icon}</span>
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
                  <span style={{ fontSize: "1rem", lineHeight: 1 }}>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User profile + Theme toggle */}
        <div style={{ borderTop: "2px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.25rem", marginBottom: "0.25rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--accent)", border: "2px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", fontWeight: 800, color: "var(--text)", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.full_name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {profile.role === "ADMIN" ? "Admin" : profile.employment_type === "INTERN" ? "Intern" : "Full-time"}
              </div>
            </div>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            <span style={{ fontSize: "1rem" }}>{theme === "light" ? "🌙" : "☀️"}</span>
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
          <button onClick={signOut} disabled={signingOut} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.78rem", padding: "0.4rem" }}>
            {signingOut ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header style={{ display: "none" }} className="mobile-header">
        <button onClick={() => setMenuOpen(!menuOpen)} className="btn btn-ghost" style={{ padding: "0.4rem 0.6rem" }}>{"\u2630"}</button>
        <span className="font-title" style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text)" }}>Stride</span>
        <button onClick={toggleTheme} className="btn btn-ghost" style={{ padding: "0.4rem 0.6rem", fontSize: "1rem" }}>
          {theme === "light" ? "🌙" : "☀️"}
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
            background: var(--surface); border-bottom: 2px solid var(--border);
            padding: 0 1rem; z-index: 30;
          }
        }
      `}</style>
    </div>
  );
}
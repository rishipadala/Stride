"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SPIDEY_QUOTES = [
  "With great power comes great productivity! 🕷️",
  "Your friendly neighborhood work tracker awaits!",
  "Anyone can wear the mask. Time to suit up! 🦸",
  "Every hero needs a log. This is yours. 🕸️",
  "The city never sleeps, and neither does your hustle! ⚡",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote] = useState(() => SPIDEY_QUOTES[Math.floor(Math.random() * SPIDEY_QUOTES.length)]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/today");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        {/* Hero section */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: ".5rem" }}>🕸️</div>
          <h1 className="font-title" style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: ".35rem", letterSpacing: "-0.02em" }}>Stride</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".85rem", fontWeight: 500, lineHeight: 1.5 }}>
            {quote}
          </p>
        </div>

        {/* Welcome back message */}
        <div style={{
          padding: ".6rem .9rem", borderRadius: "var(--radius-sm)",
          border: "2px solid var(--border)", marginBottom: "1.25rem",
          background: "var(--accent-dim)", fontSize: ".82rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: ".5rem",
          boxShadow: "var(--shadow-xs)",
        }}>
          <span style={{ fontSize: "1.1rem" }}>👋</span>
          <span>Welcome back, hero! Sign in to continue your streak.</span>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div className="form-group">
            <label className="input-label">Email</label>
            <input id="login-email" className="input" type="email" placeholder="peter@dailybugle.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </div>
          <div className="form-group">
            <label className="input-label">Password</label>
            <input id="login-password" className="input" type="password" placeholder="Your secret identity..." value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button id="login-submit" className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: ".5rem", width: "100%", justifyContent: "center", padding: ".7rem" }}>
            {loading ? <span className="spinner" /> : "🚀 Swing In"}
          </button>
        </form>
        <div className="divider" />
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: ".875rem" }}>
          New here?{" "}
          <Link href="/signup" style={{ color: "var(--text)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" }}>Join the team</Link>
        </p>
      </div>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getQuote } from "@/lib/quotes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState("Your friendly neighborhood work tracker awaits!");
  useEffect(() => { setQuote(getQuote("login")); }, []);

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
        {/* Hero section — no emojis, Big Shoulders Display */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{
            fontFamily: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif',
            textTransform: "uppercase", fontWeight: 900,
            fontSize: "2.6rem", lineHeight: .84, letterSpacing: ".012em",
            color: "var(--text)", marginBottom: ".5rem",
          }}>Stride</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".82rem", fontWeight: 500, lineHeight: 1.5 }}>
            {quote}
          </p>
        </div>

        {/* Welcome back */}
        <div style={{
          padding: ".6rem .9rem",
          border: "2.5px solid var(--border)", marginBottom: "1.25rem",
          background: "var(--accent-dim)", fontSize: ".82rem", fontWeight: 600,
          boxShadow: "var(--shadow-xs)",
        }}>
          Welcome back, hero! Sign in to continue your streak.
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
            {loading ? <span className="spinner" /> : "Swing In"}
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
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getQuote } from "@/lib/quotes";
import Quip from "@/components/Quip";

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
        <Link href="/" id="login-back-to-home" style={{
          display: "inline-flex", alignItems: "center", gap: ".35rem",
          fontSize: ".75rem", fontWeight: 600, color: "var(--text-muted)",
          textDecoration: "none", letterSpacing: ".02em",
          marginBottom: ".75rem", transition: "color var(--dur-fast, .15s) ease",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <span aria-hidden="true" style={{ fontSize: ".85rem", lineHeight: 1 }}>←</span>
          Back to Home
        </Link>
        {/* Hero section — no emojis, Big Shoulders Display */}
        <div style={{ textAlign: "center", marginBottom: "1.9rem" }}>
          <h1 style={{
            fontFamily: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif',
            textTransform: "uppercase", fontWeight: 900,
            fontSize: "2.6rem", lineHeight: .84, letterSpacing: ".012em",
            color: "var(--text)", marginBottom: ".5rem",
          }}>Stride</h1>
          <p className="font-mono" style={{
            color: "var(--text-muted)", fontSize: ".6rem", fontWeight: 600,
            letterSpacing: ".12em", textTransform: "uppercase",
          }}>
            Your friendly neighborhood tracker
          </p>
        </div>

        {/* The quote and the old "Welcome back, hero!" strip were saying
            the same thing twice, in two different voices. One panel now
            carries both jobs — greeting and line. */}
        <Quip key={quote} quote={quote} context="login" plate style={{ marginBottom: "1.6rem" }} />

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
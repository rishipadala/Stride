"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = password.length === 0 ? null : password.length < 6 ? "weak" : password.length < 10 ? "okay" : "strong";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        {/* Hero section */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{
            fontFamily: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif',
            textTransform: "uppercase", fontWeight: 900,
            fontSize: "2.6rem", lineHeight: .84, letterSpacing: ".012em",
            color: "var(--text)", marginBottom: ".5rem",
          }}>Stride</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".82rem", fontWeight: 500, lineHeight: 1.5 }}>
            Every hero starts somewhere. This is your origin story.
          </p>
        </div>

        {/* Feature callout — ink panel, no emojis */}
        <div style={{
          padding: ".7rem .9rem",
          border: "2.5px solid var(--border)", marginBottom: "1.25rem",
          background: "var(--accent-dim)", fontSize: ".76rem", fontWeight: 600,
          boxShadow: "var(--shadow-xs)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
            <span>Track daily streaks &amp; build consistency</span>
            <span>Personal stats &amp; work log history</span>
            <span>Free, open source, no card required</span>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div className="form-group">
            <label className="input-label">Work Email</label>
            <input id="signup-email" className="input" type="email" placeholder="peter@dailybugle.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </div>
          <div className="form-group">
            <label className="input-label">Password</label>
            <input id="signup-password" className="input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
            {passwordStrength && (
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: ".25rem" }}>
                <div style={{ flex: 1, height: 4, background: "var(--surface-alt)", overflow: "hidden", border: "1px solid var(--border)" }}>
                  <div style={{
                    height: "100%",
                    width: passwordStrength === "weak" ? "33%" : passwordStrength === "okay" ? "66%" : "100%",
                    background: passwordStrength === "weak" ? "#ef4444" : passwordStrength === "okay" ? "#f59e0b" : "#22c55e",
                    transition: "width .3s, background .3s",
                  }} />
                </div>
                <span style={{
                  fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
                  color: passwordStrength === "weak" ? "#ef4444" : passwordStrength === "okay" ? "#f59e0b" : "#22c55e",
                }}>
                  {passwordStrength === "weak" ? "Weak" : passwordStrength === "okay" ? "Good" : "Strong"}
                </span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="input-label">Confirm Password</label>
            <input id="signup-confirm" className="input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
            {confirm.length > 0 && (
              <div style={{ fontSize: ".7rem", fontWeight: 700, marginTop: ".2rem", color: password === confirm ? "#22c55e" : "#ef4444" }}>
                {password === confirm ? "Passwords match" : "Passwords don\u2019t match"}
              </div>
            )}
          </div>
          <button id="signup-submit" className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: ".5rem", width: "100%", justifyContent: "center", padding: ".7rem" }}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
        </form>
        <div className="divider" />
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: ".875rem" }}>
          Already a hero?{" "}
          <Link href="/login" style={{ color: "var(--text)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
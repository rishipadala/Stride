"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError("Full name is required"); return; }
    setError(""); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired. Please sign in again."); setLoading(false); return; }
    const { error } = await supabase.from("profiles").insert({
      id: user.id, full_name: fullName.trim(), email: user.email!,
      employment_type: employmentType, start_date: startDate || null, role: "EMPLOYEE",
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/today");
    router.refresh();
  }

  const firstName = fullName.trim().split(" ")[0];

  return (
    <div className="auth-page">
      <div className="auth-card animate-in" style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>🕷️</div>
          <p style={{ color: "var(--text-muted)", fontSize: ".78rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: ".5rem" }}>Origin Story</p>
          <h1 className="font-title" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: ".5rem" }}>
            {firstName ? `Nice to meet you, ${firstName}!` : "Tell us about yourself"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".85rem", lineHeight: 1.5 }}>
            Quick setup — 30 seconds and you&apos;re swinging through your work logs! 🕸️
          </p>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="form-group">
            <label className="input-label">Full Name *</label>
            <input id="ob-name" className="input" type="text" placeholder="Peter Parker" value={fullName} onChange={e => setFullName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="input-label">Employment Type</label>
            <select id="ob-type" className="input" value={employmentType} onChange={e => setEmploymentType(e.target.value)}>
              <option value="FULL_TIME">Full-time</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Start Date</label>
            <input id="ob-start" className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ fontSize: ".68rem", color: "var(--text-muted)", fontWeight: 500 }}>When did you join? This helps track your attendance range.</span>
          </div>
          <button id="ob-submit" className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: ".25rem", width: "100%", justifyContent: "center", padding: ".75rem" }}>
            {loading ? <span className="spinner" /> : "🚀 Let's Go!"}
          </button>
        </form>
      </div>
    </div>
  );
}
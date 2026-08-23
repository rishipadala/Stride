"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"success"|"error";text:string}|null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data); setFullName(data.full_name);
        setEmploymentType(data.employment_type ?? "FULL_TIME");
        setStartDate(data.start_date ?? "");
      }
    }
    load();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setMsg({ type: "error", text: "Full name is required" }); return; }
    setSaving(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(), employment_type: employmentType, start_date: startDate || null,
    }).eq("id", user!.id);
    setMsg(error ? { type: "error", text: error.message } : { type: "success", text: "Profile saved!" });
    setSaving(false);
  }

  if (!profile) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: 520 }}>
      <div>
        <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 800 }}>Settings</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>Update your profile information</p>
      </div>

      <div className="card">
        {/* Non-editable info */}
        <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", border: "2px solid var(--border)", display: "flex", flexDirection: "column", gap: ".5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Email</span>
            <span className="font-mono" style={{ fontSize: ".8rem" }}>{profile.email}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Role</span>
            <span style={{ fontWeight: 700 }}>{profile.role === "ADMIN" ? "Administrator" : "Employee"}</span>
          </div>
        </div>

        {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: "1.25rem" }}>{msg.text}</div>}

        <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div className="form-group">
            <label className="input-label">Full Name *</label>
            <input id="settings-name" className="input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="input-label">Employment Type</label>
            <select id="settings-type" className="input" value={employmentType} onChange={e => setEmploymentType(e.target.value)}>
              <option value="FULL_TIME">Full-time</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Start Date</label>
            <input id="settings-start" className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <button id="settings-save" className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? <span className="spinner" /> : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
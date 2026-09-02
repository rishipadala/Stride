"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYMENT_TYPES } from "@/lib/utils";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"success"|"error";text:string}|null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data); setFullName(data.full_name);
        setEmploymentType(data.employment_type ?? "FULL_TIME");
        setStartDate(data.start_date ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setIsPublic(data.is_public ?? false);
      }
    }
    load();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setMsg({ type: "error", text: "Full name is required" }); return; }

    const handle = username.trim();
    // The DB enforces ^[a-zA-Z0-9_]{3,24}$. Catching it here means a
    // typo reads as guidance instead of a Postgres constraint name.
    if (handle && handle.length < 3) {
      setMsg({ type: "error", text: "Usernames need at least 3 characters." });
      return;
    }
    if (isPublic && !handle) {
      setMsg({ type: "error", text: "Pick a username first — it's the address your profile lives at." });
      return;
    }

    setSaving(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg({ type: "error", text: "Your session expired. Sign in again to save." });
      setSaving(false); return;
    }

    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(), employment_type: employmentType, start_date: startDate || null,
      username: handle || null,
      bio: bio.trim() || null,
      is_public: isPublic,
    }).eq("id", user.id);

    if (error) {
      // 23505 = unique violation on profiles_username_lower_uniq.
      setMsg({
        type: "error",
        text: error.code === "23505"
          ? `"${handle}" is taken. Try another.`
          : error.message,
      });
    } else {
      setMsg({ type: "success", text: "Profile saved" });
      setProfile({ ...profile, username: handle || null, is_public: isPublic });
    }
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
        <h1 className="font-title" style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: .94 }}>Settings</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>Update your profile information</p>
      </div>

      <div className="card">
        {/* Non-editable info */}
        <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--surface-alt)", border: "2.5px solid var(--border)", display: "flex", flexDirection: "column", gap: ".5rem" }}>
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
            <label className="input-label" htmlFor="settings-name">Full Name *</label>
            <input id="settings-name" className="input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="input-label" htmlFor="settings-type">What best describes you?</label>
            <select id="settings-type" className="input" value={employmentType} onChange={e => setEmploymentType(e.target.value)}>
              {EMPLOYMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label" htmlFor="settings-start">Start Date</label>
            <input id="settings-start" className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div className="divider" style={{ margin: "0.5rem 0" }} />

          <div style={{ marginBottom: "0.25rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Public Profile</h2>
            {/* Naming the exact fields matters: this switch publishes
                to an unauthenticated URL, and the person flipping it
                should not have to guess what "share your streak"
                includes. Mirrors migrations/003_public_profiles_rls.sql. */}
            <p style={{ color: "var(--text-muted)", fontSize: ".85rem", marginTop: ".2rem", lineHeight: 1.55 }}>
              Turning this on publishes a page anyone can open — no login. It shows your
              name, what you do, your bio, your streak, how many days you&apos;ve showed up,
              and your badges. Your email, your notes, and everything in your work log
              stay private.
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: ".75rem", cursor: "pointer", background: "var(--surface-alt)", padding: ".85rem 1rem", border: "2.5px solid var(--border)" }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--cb-red, #d6202a)", cursor: "pointer" }}
            />
            <span style={{ fontWeight: 700, fontSize: ".9rem" }}>Make my profile public</span>
          </label>

          {isPublic && profile?.username && (
             <div style={{ fontSize: ".85rem", fontWeight: 600, background: "#bbf7d0", color: "#15803d", padding: ".6rem .9rem", border: "2.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
               <span>Your profile is live at:</span>
               <a href={`/share/${profile.username}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "inherit" }}>
                 /share/{profile.username}
               </a>
             </div>
          )}

          <div className="form-group">
            <label className="input-label" htmlFor="settings-username">Username</label>
            <input id="settings-username" className="input" type="text" placeholder="e.g. peterparker" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={24} />
            <span style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>
              3–24 characters. Letters, numbers and underscores.
            </span>
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="settings-bio">Bio</label>
            <textarea id="settings-bio" className="input" placeholder="A short bio..." value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={160} style={{ resize: "vertical" }} />
          </div>

          <button id="settings-save" className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start", marginTop: ".5rem" }}>
            {saving ? <span className="spinner" /> : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
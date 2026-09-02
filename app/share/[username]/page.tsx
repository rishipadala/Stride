import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { ACHIEVEMENTS, TIER_COLOR, computeStats, type AttLike } from "@/lib/achievements";
import { employmentLabel } from "@/lib/utils";

// ============================================================
// /share/[username] — the only unauthenticated, data-backed page
// in the app. Two rules govern it:
//
//   1. It uses the ANON client (createPublicClient), never the
//      service-role one. Everything it can see is decided by
//      migrations/003_public_profiles_rls.sql, not by this file.
//      A mistake here leaks nothing that RLS hasn't already
//      allowed.
//   2. The username is validated before it reaches a query, and
//      matched with indexed equality on username_lower -- not
//      ILIKE, whose `_` wildcard could serve the wrong profile.
// ============================================================

export const revalidate = 60;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

type PublicProfile = {
  id: string;
  full_name: string;
  username: string | null;
  bio: string | null;
  employment_type: string | null;
};

/** Null means "no such public profile". Throws if the database is unreachable. */
async function getProfile(raw: string): Promise<PublicProfile | null> {
  if (!USERNAME_RE.test(raw)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, bio, employment_type")
    .eq("username_lower", raw.toLowerCase())
    .eq("is_public", true)
    .maybeSingle();

  // A transport or permission error is NOT a 404. Letting it fall
  // through to notFound() would cache "this person doesn't exist"
  // for 60 seconds every time the database hiccups.
  if (error) throw new Error(`Public profile lookup failed: ${error.message}`);
  return data as PublicProfile | null;
}

export async function generateMetadata(
  props: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getProfile(username).catch(() => null);
  if (!profile) return { title: "Profile not found · Stride" };

  const role = employmentLabel(profile.employment_type);
  return {
    title: `${profile.full_name} · Stride`,
    description: profile.bio?.trim() || `${role} tracking every day on Stride.`,
    openGraph: {
      title: `${profile.full_name} · Stride`,
      description: profile.bio?.trim() || `${role} tracking every day on Stride.`,
    },
  };
}

/** "Peter Parker" -> "PP". Two letters, no emoji, always renders. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}

export default async function PublicProfilePage(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const supabase = createPublicClient();

  // RLS already restricts these to this profile's rows, and to
  // show-up statuses only. The filters are for the query planner.
  const [badgeRes, attRes, countRes] = await Promise.all([
    supabase
      .from("achievements")
      .select("code, unlocked_at")
      .eq("user_id", profile.id)
      .order("unlocked_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("date, status")
      .eq("user_id", profile.id)
      .order("date", { ascending: false })
      .limit(1000),
    supabase
      .from("attendance")
      .select("date", { count: "exact", head: true })
      .eq("user_id", profile.id),
  ]);

  // The streak is computed by the SAME function the private
  // dashboard uses, so a public number can never drift from the
  // one its owner sees.
  const stats = computeStats((attRes.data ?? []) as AttLike[], []);
  const showUpDays = countRes.count ?? stats.showUpDays;

  const unlocked = new Set((badgeRes.data ?? []).map(a => a.code));
  const badges = ACHIEVEMENTS.filter(a => unlocked.has(a.code));

  return (
    <div className="pp">
      <div className="pp-inner animate-in">
        <header className="pp-top">
          <Link href="/" className="pp-brand font-title">Stride</Link>
          {profile.username && <span className="pp-handle font-mono">@{profile.username}</span>}
        </header>

        <section className="card pp-hero">
          <div className="pp-id">
            <div className="pp-avatar font-title">{initialsOf(profile.full_name)}</div>
            <div className="pp-name-wrap">
              <h1 className="font-title pp-name">{profile.full_name}</h1>
              <div className="font-mono pp-role">{employmentLabel(profile.employment_type)}</div>
            </div>
          </div>
          {profile.bio?.trim() && <p className="pp-bio">{profile.bio}</p>}
        </section>

        {/* Two numbers, one plate of colour. The streak earns the
            yellow because it's the only one that can go to zero. */}
        <section className="pp-stats">
          <div className="card pp-stat pp-stat-streak">
            <div className="font-title pp-stat-value">{stats.currentStreak}</div>
            <div className="font-mono pp-stat-label">Day streak</div>
          </div>
          <div className="card pp-stat">
            <div className="font-title pp-stat-value">{showUpDays}</div>
            <div className="font-mono pp-stat-label">Days showed up</div>
          </div>
        </section>

        {badges.length > 0 && (
          <section>
            <h2 className="font-title pp-h2">Badges earned</h2>
            <div className="pp-badges">
              {badges.map(b => (
                <div key={b.code} className="card-sm pp-badge">
                  <div className="pp-badge-icon font-title" style={{ background: TIER_COLOR[b.tier] }}>
                    {b.iconText}
                  </div>
                  <div className="pp-badge-name">{b.name}</div>
                  <div className="pp-badge-desc">{b.desc}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="pp-foot font-mono">
          Tracked with <Link href="/" className="pp-foot-link">Stride</Link> — your friendly
          neighborhood tracker.
        </footer>
      </div>

      <style>{`
        .pp { min-height: 100vh; padding: 2rem 1.25rem 4rem; display: flex; justify-content: center; }
        .pp-inner { width: 100%; max-width: 620px; display: flex; flex-direction: column; gap: 1.5rem; }

        .pp-top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
        .pp-brand { font-size: 1.6rem; font-weight: 900; line-height: .82; color: var(--text); text-decoration: none; }
        .pp-handle { font-size: .78rem; color: var(--text-muted); }

        .pp-hero { display: flex; flex-direction: column; gap: 1.1rem; }
        .pp-id { display: flex; align-items: center; gap: 1.1rem; }
        .pp-avatar {
          width: 68px; height: 68px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface-alt); border: 2.5px solid var(--border);
          box-shadow: var(--shadow-xs);
          font-size: 1.5rem; font-weight: 900; color: var(--text); letter-spacing: .02em;
        }
        .pp-name-wrap { min-width: 0; }
        .pp-name { font-size: 2.1rem; font-weight: 900; line-height: .94; margin: 0; overflow-wrap: anywhere; }
        .pp-role { font-size: .74rem; color: var(--text-muted); margin-top: .3rem; text-transform: uppercase; letter-spacing: .07em; font-weight: 600; }
        .pp-bio { font-size: .95rem; line-height: 1.6; margin: 0; padding-top: 1.1rem; border-top: 2.5px solid var(--border); }

        .pp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .pp-stat { display: flex; flex-direction: column; align-items: flex-start; gap: .4rem; padding: 1.4rem 1.25rem; }
        .pp-stat-streak { background: var(--accent); }
        .pp-stat-streak .pp-stat-value, .pp-stat-streak .pp-stat-label { color: #000; }
        .pp-stat-value { font-size: 3.2rem; font-weight: 900; line-height: .84; }
        .pp-stat-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); }

        .pp-h2 { font-size: 1.35rem; font-weight: 900; margin: 0 0 .85rem; }
        .pp-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .9rem; }
        .pp-badge { display: flex; flex-direction: column; gap: .45rem; padding: 1rem .9rem; }
        .pp-badge-icon {
          width: 42px; height: 42px;
          display: flex; align-items: center; justify-content: center;
          border: 2.5px solid var(--border); box-shadow: var(--shadow-xs);
          font-size: 1.1rem; font-weight: 900; color: #000;
        }
        .pp-badge-name { font-size: .88rem; font-weight: 800; line-height: 1.2; }
        .pp-badge-desc { font-size: .72rem; color: var(--text-muted); line-height: 1.45; }

        .pp-foot { font-size: .72rem; color: var(--text-muted); text-align: center; padding-top: 1rem; border-top: 2.5px solid var(--border); }
        .pp-foot-link { color: var(--text); font-weight: 700; text-decoration: none; border-bottom: 2px solid var(--accent); }

        @media (max-width: 460px) {
          .pp-name { font-size: 1.7rem; }
          .pp-avatar { width: 56px; height: 56px; font-size: 1.25rem; }
          .pp-stat-value { font-size: 2.6rem; }
        }
      `}</style>
    </div>
  );
}

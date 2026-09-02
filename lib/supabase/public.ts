import { createClient } from "@supabase/supabase-js";

// ============================================================
// The anonymous, session-less client. For public pages only.
//
// Why not reuse lib/supabase/server.ts? That client reads cookies,
// which does two unwanted things on a page like /share/[username]:
//
//   1. It forces dynamic rendering, so `export const revalidate`
//      is quietly ignored and every visit hits the database.
//   2. It renders the page AS THE VISITOR. If a logged-in user
//      opens someone's share link, the page is built with their
//      session -- and if that render is ever cached, one person's
//      privileged view gets served to the next visitor.
//
// This client carries no session at all, so /share renders
// identically for everyone and RLS evaluates it as `anon`. That is
// the whole security model of the public profile: the page can only
// ever see what migrations/003_public_profiles_rls.sql grants to
// anonymous visitors. Nothing about the page's own code decides
// what is safe to show.
//
// Contrast with lib/supabase/admin.ts, which bypasses RLS entirely
// and must never be reachable from a public URL.
// ============================================================
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

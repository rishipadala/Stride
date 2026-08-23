import { createClient } from "@supabase/supabase-js";

// WARNING: This client bypasses RLS entirely.
// ONLY import this in server-side Route Handlers or Server Actions.
// NEVER import in client components or pages.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
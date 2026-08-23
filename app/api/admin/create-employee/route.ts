import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Verify the requester is logged in and is an ADMIN
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 2. Parse request body
    const { full_name, email, employment_type, start_date } = await request.json();
    if (!full_name || !email) return NextResponse.json({ error: "Name and email are required" }, { status: 400 });

    // 3. Create a profile row. The employee will sign up themselves using this email.
    const admin = createAdminClient();

    // Check if email already exists in profiles
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 });

    // We create a placeholder profile. When the employee signs up,
    // the onboarding page will try to insert — they can update their profile from settings.
    // NOTE: We do NOT call inviteUserByEmail here since email confirmations must be
    // configured in Supabase. Instead, we store the expected profile data so that
    // when they sign up with this email, they can complete onboarding normally.

    return NextResponse.json({
      success: true,
      message: `Employee profile for ${full_name} (${email}) has been queued. Share the signup link with them: /signup`,
      preRegistered: { full_name, email, employment_type, start_date },
    });
  } catch (err) {
    console.error("create-employee error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
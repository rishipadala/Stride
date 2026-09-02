import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Public paths - always allowed (no auth required)
  // "/" is the marketing landing page; "/share" hosts public profiles.
  const publicPaths = ["/login", "/signup", "/auth/callback", "/share"];
  if (path === "/" || publicPaths.some((p) => path.startsWith(p))) return supabaseResponse;

  // Not logged in -> /login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but no profile yet -> /onboarding (except if already there)
  if (path !== "/onboarding") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Admin-only routes
    if (path.startsWith("/admin") && profile.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/today", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
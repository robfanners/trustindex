import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// GET /auth/callback — Server-side PKCE code exchange
//
// Supabase's @supabase/ssr stores the PKCE code verifier in an httpOnly
// cookie. The code exchange MUST happen server-side so we can read that
// cookie. A client-side page.tsx cannot access httpOnly cookies.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const claim = searchParams.get("claim");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // setAll can fail in certain contexts — non-fatal
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If the Explorer claim flag is set, redirect via the client-side
      // /auth/complete page so it can read localStorage and call the
      // claim API before landing on the dashboard.
      if (claim === "1") {
        const completeUrl = new URL("/auth/complete", origin);
        completeUrl.searchParams.set("next", next);
        completeUrl.searchParams.set("claim", "1");
        return NextResponse.redirect(completeUrl);
      }

      // Normal login — redirect straight to the destination
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // No code or exchange failed — redirect to login with error
  return NextResponse.redirect(
    new URL("/auth/login?error=auth_failed", origin)
  );
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// PATCH /api/settings/profile — update profile fields
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = ["full_name", "company_name", "company_size", "role"] as const;
const MAX_LENGTH = 200;

export async function PATCH(req: Request) {
  try {
    // 1. Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Parse + validate body
    const body = await req.json();
    const updates: Record<string, string> = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const val = body[field];
        if (typeof val !== "string") {
          return NextResponse.json(
            { error: `${field} must be a string` },
            { status: 400 }
          );
        }
        if (val.length > MAX_LENGTH) {
          return NextResponse.json(
            { error: `${field} must be at most ${MAX_LENGTH} characters` },
            { status: 400 }
          );
        }
        updates[field] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // 3. Update profile
    const db = supabaseServer();
    const { data, error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("id, email, plan, full_name, company_name, company_size, role, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

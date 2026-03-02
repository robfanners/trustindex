import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canEditPolicy } from "@/lib/entitlements";

export const runtime = "nodejs";

// GET — list regulatory updates, filterable by jurisdiction
export async function GET(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    const isPro = canEditPolicy(plan); // Pro+ gets sector-specific content

    const { searchParams } = new URL(req.url);
    const jurisdiction = searchParams.get("jurisdiction"); // "uk" | "eu" | null

    const sb = supabaseServer();
    let query = sb
      .from("regulatory_updates")
      .select("*")
      .order("published_at", { ascending: false });

    if (jurisdiction) {
      query = query.contains("jurisdictions", [jurisdiction]);
    }

    // Non-pro users don't see sector-specific items
    if (!isPro) {
      query = query.or("sector_tags.is.null,sector_tags.eq.{}");
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch updates" }, { status: 500 });
    }

    return NextResponse.json({ updates: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// POST — admin-only: add new regulatory update
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Admin check — use admin role from profiles
    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { title, summary, source_url, jurisdictions, sector_tags, published_at } = body;

    if (!title || !summary) {
      return NextResponse.json({ error: "Title and summary required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("regulatory_updates")
      .insert({
        title,
        summary,
        source_url: source_url || null,
        jurisdictions: jurisdictions || [],
        sector_tags: sector_tags || [],
        published_at: published_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create update" }, { status: 500 });
    }

    return NextResponse.json({ update: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

import { requireAuth, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { canEditPolicy } from "@/lib/entitlements";
import { createRegulatoryUpdateSchema } from "@/lib/validations";

export const runtime = "nodejs";

// GET — list regulatory updates, filterable by jurisdiction
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { plan, db } = auth;

    const isPro = canEditPolicy(plan); // Pro+ gets sector-specific content

    const { searchParams } = new URL(req.url);
    const jurisdiction = searchParams.get("jurisdiction"); // "uk" | "eu" | null

    let query = db
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
      throw new Error("Failed to fetch updates");
    }

    return apiOk({ updates: data ?? [] });
  });
}

// POST — admin-only: add new regulatory update
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { db } = auth;

    // Admin check — use admin role from profiles
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", auth.user?.id)
      .single();

    if (profile?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const parsed = await parseBody(req, createRegulatoryUpdateSchema);
    if (parsed.error) return parsed.error;
    const { title, summary, sourceUrl, jurisdiction, effectiveDate, category } = parsed.data;

    const { data, error } = await db
      .from("regulatory_updates")
      .insert({
        title,
        summary,
        source_url: sourceUrl || null,
        jurisdictions: jurisdiction ? [jurisdiction] : [],
        sector_tags: category ? [category] : [],
        published_at: effectiveDate || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error("Failed to create update");
    }

    return apiOk({ update: data }, 201);
  });
}

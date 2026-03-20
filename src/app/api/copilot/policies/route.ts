import { NextRequest } from "next/server";
import { requireAuth, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET — list all policies for the org
// ---------------------------------------------------------------------------

export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { data: policies, error } = await db
      .from("ai_policies")
      .select("id, title, policy_type, version, status, content, is_edited, approved_by, approved_at, created_by, created_at, updated_at")
      .eq("organisation_id", orgId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error("Failed to fetch policies");

    return apiOk({ policies: policies ?? [] });
  });
}

// ---------------------------------------------------------------------------
// POST — create a new policy (manual, not AI-generated)
// ---------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  policy_type: z.enum([
    "acceptable_use", "data_handling", "staff_guidelines", "risk_assessment",
    "transparency", "bias_monitoring", "vendor_management", "incident_response",
    "human_oversight", "model_lifecycle",
  ]),
  content: z.string().optional().default(""),
  status: z.enum(["draft", "under_review", "active", "archived"]).optional().default("draft"),
});

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;

    const parsed = await parseBody(req, createSchema);
    if (parsed.error) return parsed.error;
    const { title, policy_type, content, status } = parsed.data;

    const { data: policy, error } = await db
      .from("ai_policies")
      .insert({
        organisation_id: orgId,
        title,
        policy_type,
        content,
        status,
        version: 1,
        created_by: user.id,
        generated_by: "manual",
      })
      .select("id, title, policy_type, version, status, created_at")
      .single();

    if (error) throw new Error("Failed to create policy");

    return apiOk({ policy }, 201);
  });
}

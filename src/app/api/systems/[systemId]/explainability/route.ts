import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const createExplainabilitySchema = z.object({
  method: z.enum(["none", "feature_importance", "shap", "lime", "rule_based", "counterfactual", "model_card"]),
  documentation_url: z.string().url().optional(),
  reviewer_notes: z.string().optional(),
  coverage_percent: z.number().min(0).max(100).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data, error } = await auth.db
    .from("system_explainability")
    .select("*")
    .eq("system_id", (await params).systemId)
    .eq("org_id", auth.orgId)
    .single();

  if (error && error.code !== "PGRST116") {
    return apiError(error.message, 500);
  }

  return apiOk({ explainability: data || null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, createExplainabilitySchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("system_explainability")
    .upsert([
      {
        system_id: (await params).systemId,
        org_id: auth.orgId,
        last_reviewed_at: new Date().toISOString(),
        ...parsed.data,
      },
    ])
    .select();

  if (error) return apiError(error.message, 500);
  return apiOk({ explainability: data[0] }, 201);
}

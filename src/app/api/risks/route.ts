import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const createRiskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  system_id: z.string().uuid().optional().nullable(),
  likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost_certain"]).default("possible"),
  impact: z.enum(["insignificant", "minor", "moderate", "major", "catastrophic"]).default("moderate"),
  residual_score: z.number().optional(),
  treatment: z.enum(["accept", "mitigate", "transfer", "avoid"]).default("mitigate"),
  owner_user_id: z.string().uuid().optional().nullable(),
  review_due_date: z.string().optional(),
  status: z.enum(["open", "mitigated", "accepted", "closed"]).default("open"),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const system_id = url.searchParams.get("system_id");

  let query = auth.db
    .from("risk_registry")
    .select("*")
    .eq("org_id", auth.orgId);

  if (system_id) {
    query = query.eq("system_id", system_id);
  }

  const { data, error } = await query.order("inherent_score", { ascending: false });

  if (error) return apiError(error.message, 500);
  return apiOk({ risks: data });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, createRiskSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("risk_registry")
    .insert([
      {
        org_id: auth.orgId,
        ...parsed.data,
      },
    ])
    .select();

  if (error) return apiError(error.message, 500);
  return apiOk({ risk: data[0] }, 201);
}

import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const createRaciSchema = z.object({
  entity_type: z.enum(["system", "control", "risk", "policy", "incident"]),
  entity_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["responsible", "accountable", "consulted", "informed"]),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const entity_type = url.searchParams.get("entity_type");
  const entity_id = url.searchParams.get("entity_id");

  let query = auth.db
    .from("raci_assignments")
    .select("*")
    .eq("org_id", auth.orgId);

  if (entity_type) {
    query = query.eq("entity_type", entity_type);
  }
  if (entity_id) {
    query = query.eq("entity_id", entity_id);
  }

  const { data, error } = await query.order("role", { ascending: true });

  if (error) return apiError(error.message, 500);
  return apiOk({ raci_assignments: data });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, createRaciSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("raci_assignments")
    .insert([
      {
        org_id: auth.orgId,
        assigned_by: auth.user.id,
        ...parsed.data,
      },
    ])
    .select();

  if (error) return apiError(error.message, 500);
  return apiOk({ raci_assignment: data[0] }, 201);
}

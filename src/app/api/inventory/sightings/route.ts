import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const createSightingSchema = z.object({
  tool_name: z.string().min(1),
  domain: z.string().optional(),
  detected_via: z.enum(["manual", "email", "browser_extension", "integration"]),
  notes: z.string().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data, error } = await auth.db
    .from("ai_tool_sightings")
    .select("*")
    .eq("org_id", auth.orgId)
    .order("last_seen", { ascending: false });

  if (error) return apiError(error.message, 500);
  return apiOk({ sightings: data });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, createSightingSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("ai_tool_sightings")
    .insert([
      {
        org_id: auth.orgId,
        ...parsed.data,
      },
    ])
    .select();

  if (error) return apiError(error.message, 500);
  return apiOk({ sighting: data[0] }, 201);
}

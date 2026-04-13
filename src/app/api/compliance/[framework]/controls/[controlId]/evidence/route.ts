import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const createEvidenceLinkSchema = z.object({
  evidence_type: z.enum(["attestation", "document", "system_run", "policy", "external_link"]),
  evidence_ref: z.string().optional(),
  evidence_url: z.string().url().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ framework: string; controlId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data, error } = await auth.db
    .from("control_evidence_links")
    .select("*")
    .eq("org_id", auth.orgId)
    .eq("framework_code", (await params).framework)
    .eq("control_id", (await params).controlId)
    .order("linked_at", { ascending: false });

  if (error) return apiError(error.message, 500);
  return apiOk({ evidence_links: data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ framework: string; controlId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, createEvidenceLinkSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("control_evidence_links")
    .insert([
      {
        org_id: auth.orgId,
        framework_code: (await params).framework,
        control_id: (await params).controlId,
        linked_by: auth.user.id,
        ...parsed.data,
      },
    ])
    .select();

  if (error) return apiError(error.message, 500);
  return apiOk({ evidence_link: data[0] }, 201);
}

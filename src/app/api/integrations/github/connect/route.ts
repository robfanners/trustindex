import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";
import { validateGitHubToken } from "@/lib/github";
import { z } from "zod";

const connectSchema = z.object({
  token: z.string().min(1).max(500),
  repos: z.array(z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
  })).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = connectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const valid = await validateGitHubToken(parsed.data.token);
  if (!valid) {
    return apiError("Invalid GitHub token", 400);
  }

  const { data, error } = await auth.db
    .from("integration_connections")
    .upsert({
      organisation_id: auth.orgId,
      provider: "github",
      status: "connected",
      access_token: parsed.data.token,
      sync_config: { repos: parsed.data.repos },
    }, { onConflict: "organisation_id,provider" })
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "integration",
    entityId: data.id,
    actionType: "connected",
    performedBy: auth.user.id,
    metadata: { provider: "github", repos: parsed.data.repos.length },
  });

  return apiOk({ data: { status: "connected", repos: parsed.data.repos } });
}

export async function DELETE(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  await auth.db
    .from("integration_connections")
    .update({ status: "disconnected", access_token: null })
    .eq("organisation_id", auth.orgId)
    .eq("provider", "github");

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "integration",
    entityId: "github",
    actionType: "disconnected",
    performedBy: auth.user.id,
    metadata: { provider: "github" },
  });

  return apiOk({ data: { status: "disconnected" } });
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
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
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  const parsed = connectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const valid = await validateGitHubToken(parsed.data.token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid GitHub token" }, { status: 400 });
  }

  const { data, error } = await db
    .from("integration_connections")
    .upsert({
      organisation_id: profile.organisation_id,
      provider: "github",
      status: "connected",
      access_token: parsed.data.token,
      sync_config: { repos: parsed.data.repos },
    }, { onConflict: "organisation_id,provider" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: profile.organisation_id,
    entityType: "integration",
    entityId: data.id,
    actionType: "connected",
    performedBy: user.id,
    metadata: { provider: "github", repos: parsed.data.repos.length },
  });

  return NextResponse.json({ data: { status: "connected", repos: parsed.data.repos } });
}

export async function DELETE(_req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  await db
    .from("integration_connections")
    .update({ status: "disconnected", access_token: null })
    .eq("organisation_id", profile.organisation_id)
    .eq("provider", "github");

  await writeAuditLog({
    organisationId: profile.organisation_id,
    entityType: "integration",
    entityId: "github",
    actionType: "disconnected",
    performedBy: user.id,
    metadata: { provider: "github" },
  });

  return NextResponse.json({ data: { status: "disconnected" } });
}

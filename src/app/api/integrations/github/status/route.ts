import { NextResponse } from "next/server";
import { requireAuth, apiOk } from "@/lib/apiHelpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data } = await auth.db
    .from("integration_connections")
    .select("status, last_synced_at, sync_config")
    .eq("organisation_id", auth.orgId)
    .eq("provider", "github")
    .single();

  return apiOk({
    data: {
      connected: data?.status === "connected",
      last_synced_at: data?.last_synced_at ?? null,
      repos: (data?.sync_config as { repos?: unknown[] } | null)?.repos ?? [],
    },
  });
}

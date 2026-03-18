import { requireAuth, apiOk, apiError, withErrorHandling } from "@/lib/apiHelpers";

export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { data, error } = await db
      .from("subsidiaries")
      .select("id, name, created_at")
      .eq("organisation_id", orgId)
      .order("name");

    if (error) throw new Error(error.message);
    return apiOk({ subsidiaries: data });
  });
}

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { name } = await req.json();
    if (!name?.trim()) throw new Error("Name is required");

    const { data, error } = await db
      .from("subsidiaries")
      .insert({ organisation_id: orgId, name: name.trim() })
      .select("id, name, created_at")
      .single();

    if (error) throw new Error(error.message);
    return apiOk({ subsidiary: data }, 201);
  });
}

export async function DELETE(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("id param required");

    const { error } = await db
      .from("subsidiaries")
      .delete()
      .eq("id", id)
      .eq("organisation_id", orgId);

    if (error) throw new Error(error.message);
    return apiOk({ ok: true });
  });
}

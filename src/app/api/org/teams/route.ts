import { requireAuth, apiOk, withErrorHandling } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { searchParams } = new URL(req.url);
    const functionIds = searchParams.get("functionIds"); // comma-separated

    let query = db
      .from("teams")
      .select("id, name, function_id, is_adhoc, created_at")
      .eq("organisation_id", orgId)
      .order("name");

    if (functionIds) {
      const ids = functionIds.split(",").filter(Boolean);
      query = query.in("function_id", ids);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return apiOk({ teams: data });
  });
}

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { name, function_id, is_adhoc } = await req.json();
    if (!name?.trim()) throw new Error("Name is required");
    if (!function_id) throw new Error("function_id is required");

    const { data, error } = await db
      .from("teams")
      .insert({
        organisation_id: orgId,
        function_id,
        name: name.trim(),
        is_adhoc: is_adhoc ?? false,
      })
      .select("id, name, function_id, is_adhoc, created_at")
      .single();

    if (error) throw new Error(error.message);
    return apiOk({ team: data }, 201);
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
      .from("teams")
      .delete()
      .eq("id", id)
      .eq("organisation_id", orgId);

    if (error) throw new Error(error.message);
    return apiOk({ ok: true });
  });
}

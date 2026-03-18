import { requireAuth, apiOk, apiError, withErrorHandling } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { searchParams } = new URL(req.url);
    const subsidiaryIds = searchParams.get("subsidiaryIds"); // comma-separated or empty

    let query = db
      .from("functions")
      .select("id, name, subsidiary_id, is_project_type, created_at")
      .eq("organisation_id", orgId)
      .order("name");

    // If subsidiaryIds provided, filter to those subsidiaries + org-wide (null subsidiary_id) + project type
    if (subsidiaryIds) {
      const ids = subsidiaryIds.split(",").filter(Boolean);
      query = query.or(
        `subsidiary_id.in.(${ids.join(",")}),subsidiary_id.is.null,is_project_type.eq.true`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return apiOk({ functions: data });
  });
}

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { name, subsidiary_id } = await req.json();
    if (!name?.trim()) throw new Error("Name is required");

    const { data, error } = await db
      .from("functions")
      .insert({
        organisation_id: orgId,
        name: name.trim(),
        subsidiary_id: subsidiary_id || null,
      })
      .select("id, name, subsidiary_id, is_project_type, created_at")
      .single();

    if (error) throw new Error(error.message);
    return apiOk({ function: data }, 201);
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

    // Prevent deleting the Project function
    const { data: fn } = await db.from("functions").select("is_project_type").eq("id", id).single();
    if (fn?.is_project_type) {
      throw new Error("Cannot delete the Project function");
    }

    const { error } = await db
      .from("functions")
      .delete()
      .eq("id", id)
      .eq("organisation_id", orgId);

    if (error) throw new Error(error.message);
    return apiOk({ ok: true });
  });
}

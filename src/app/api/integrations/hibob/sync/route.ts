import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { fetchCompanyStructure } from "@/lib/hibob";

export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Fetch HiBob credentials
  const { data: conn } = await auth.db
    .from("integration_connections")
    .select("access_token, refresh_token")
    .eq("organisation_id", auth.orgId)
    .eq("provider", "hibob")
    .single();

  if (!conn?.access_token || !conn?.refresh_token) {
    return apiError("HiBob not connected", 400);
  }

  const serviceId = conn.access_token as string;
  const token = conn.refresh_token as string;

  // Fetch company structure from HiBob
  const structure = await fetchCompanyStructure(serviceId, token);

  const summary = { subsidiaries: 0, functions: 0, teams: 0 };

  // Map divisions → subsidiaries
  if (structure.divisions?.length) {
    for (const div of structure.divisions) {
      const { data: existing } = await auth.db
        .from("subsidiaries")
        .select("id")
        .eq("organisation_id", auth.orgId)
        .eq("name", div.name)
        .single();

      if (!existing) {
        await auth.db.from("subsidiaries").insert({
          organisation_id: auth.orgId,
          name: div.name,
        });
        summary.subsidiaries++;
      }
    }
  }

  // Reload subsidiaries for FK lookup
  const { data: allSubs } = await auth.db
    .from("subsidiaries")
    .select("id, name")
    .eq("organisation_id", auth.orgId);
  const subByName = new Map((allSubs ?? []).map((s) => [s.name, s.id]));

  // Map departments → functions
  if (structure.departments?.length) {
    for (const dept of structure.departments) {
      const { data: existing } = await auth.db
        .from("functions")
        .select("id")
        .eq("organisation_id", auth.orgId)
        .eq("name", dept.name)
        .single();

      if (!existing) {
        // Try to link to parent division/subsidiary
        let subsidiaryId: string | null = null;
        if (dept.divisionId && structure.divisions) {
          const parentDiv = structure.divisions.find((d) => d.id === dept.divisionId);
          if (parentDiv) subsidiaryId = subByName.get(parentDiv.name) ?? null;
        }

        await auth.db.from("functions").insert({
          organisation_id: auth.orgId,
          name: dept.name,
          subsidiary_id: subsidiaryId,
        });
        summary.functions++;
      }
    }
  }

  // Reload functions for FK lookup
  const { data: allFns } = await auth.db
    .from("functions")
    .select("id, name")
    .eq("organisation_id", auth.orgId);
  const fnByName = new Map((allFns ?? []).map((f) => [f.name, f.id]));

  // Map teams → teams
  if (structure.teams?.length) {
    for (const team of structure.teams) {
      const { data: existing } = await auth.db
        .from("teams")
        .select("id")
        .eq("organisation_id", auth.orgId)
        .eq("name", team.name)
        .single();

      if (!existing) {
        // Try to link to parent department/function
        let functionId: string | null = null;
        if (team.departmentId && structure.departments) {
          const parentDept = structure.departments.find((d) => d.id === team.departmentId);
          if (parentDept) functionId = fnByName.get(parentDept.name) ?? null;
        }

        // If no parent function found, link to "Project" function
        if (!functionId) {
          const { data: projectFn } = await auth.db
            .from("functions")
            .select("id")
            .eq("organisation_id", auth.orgId)
            .eq("is_project_type", true)
            .single();
          functionId = projectFn?.id ?? null;
        }

        if (functionId) {
          await auth.db.from("teams").insert({
            organisation_id: auth.orgId,
            function_id: functionId,
            name: team.name,
          });
          summary.teams++;
        }
      }
    }
  }

  // Update last_synced_at
  await auth.db
    .from("integration_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("organisation_id", auth.orgId)
    .eq("provider", "hibob");

  return apiOk({
    ok: true,
    summary,
  });
}

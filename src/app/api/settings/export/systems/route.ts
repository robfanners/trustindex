import { requireAuth, apiError } from "@/lib/apiHelpers";
import { canExportResults, getUserPlan } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/settings/export/systems — Bulk system assessment CSV export
// ---------------------------------------------------------------------------

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    // 1. Plan check
    const plan = await getUserPlan(user.id);
    if (!canExportResults(plan)) {
      return apiError("Export requires Core, Assure or Verify plan", 403);
    }

    // 2. Fetch user's systems
    const { data: systems } = await db
      .from("systems")
      .select("id, name, version_label, type, environment")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (!systems || systems.length === 0) {
      const header = "system_name,version,type,environment,run_date,status,overall_score,dimension,control,question,answer,evidence_type,evidence_note\n";
      return new Response(header, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="verisum_systems_export.csv"`,
        },
      });
    }

    const systemIds = systems.map((s) => s.id);
    const systemMap = new Map(systems.map((s) => [s.id, s]));

    // 3. Fetch system runs
    const { data: runs } = await db
      .from("system_runs")
      .select("id, system_id, version_label, status, overall_score, dimension_scores, created_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    if (!runs || runs.length === 0) {
      const header = "system_name,version,type,environment,run_date,status,overall_score,dimension,control,question,answer,evidence_type,evidence_note\n";
      return new Response(header, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="verisum_systems_export.csv"`,
        },
      });
    }

    const runIds = runs.map((r) => r.id);
    const runMap = new Map(runs.map((r) => [r.id, r]));

    // 4. Fetch system responses
    const { data: responses } = await db
      .from("system_responses")
      .select("run_id, question_id, answer, evidence_type, evidence_note")
      .in("run_id", runIds);

    // 5. Build CSV
    const header = [
      "system_name",
      "version",
      "type",
      "environment",
      "run_date",
      "status",
      "overall_score",
      "question_id",
      "answer",
      "evidence_type",
      "evidence_note",
    ];

    const lines = [header.join(",")];

    (responses || []).forEach((r: { run_id: string; question_id: string; answer: string; evidence_type: string; evidence_note: string }) => {
      const run = runMap.get(r.run_id);
      const sys = run ? systemMap.get(run.system_id) : null;
      lines.push(
        [
          sys?.name ?? "",
          run?.version_label ?? "",
          sys?.type ?? "",
          sys?.environment ?? "",
          run?.created_at ?? "",
          run?.status ?? "",
          run?.overall_score ?? "",
          r.question_id,
          r.answer ?? "",
          r.evidence_type ?? "",
          r.evidence_note ?? "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    });

    const csv = lines.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="verisum_systems_export.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return apiError(msg, 500);
  }
}

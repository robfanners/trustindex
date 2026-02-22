import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
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
  try {
    // 1. Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Plan check
    const plan = await getUserPlan(user.id);
    if (!canExportResults(plan)) {
      return NextResponse.json(
        { error: "Export requires Pro or Enterprise plan" },
        { status: 403 }
      );
    }

    const db = supabaseServer();

    // 3. Fetch user's systems
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
          "Content-Disposition": `attachment; filename="trustgraph_systems_export.csv"`,
        },
      });
    }

    const systemIds = systems.map((s) => s.id);
    const systemMap = new Map(systems.map((s) => [s.id, s]));

    // 4. Fetch system runs
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
          "Content-Disposition": `attachment; filename="trustgraph_systems_export.csv"`,
        },
      });
    }

    const runIds = runs.map((r) => r.id);
    const runMap = new Map(runs.map((r) => [r.id, r]));

    // 5. Fetch system responses
    const { data: responses } = await db
      .from("system_responses")
      .select("run_id, question_id, answer, evidence_type, evidence_note")
      .in("run_id", runIds);

    // 6. Build CSV
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
        "Content-Disposition": `attachment; filename="trustgraph_systems_export.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

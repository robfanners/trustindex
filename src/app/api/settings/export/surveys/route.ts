import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { canExportResults, getUserPlan } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/settings/export/surveys — Bulk survey CSV export
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

    // 3. Fetch user's surveys
    const { data: runs } = await db
      .from("survey_runs")
      .select("id, title, mode, status, opens_at")
      .eq("owner_user_id", user.id)
      .order("opens_at", { ascending: false });

    if (!runs || runs.length === 0) {
      // Return empty CSV with header
      const header = "survey_title,mode,status,created,invite_token,question_id,dimension,question_text,value,response_created_at\n";
      return new Response(header, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="trustgraph_surveys_export.csv"`,
        },
      });
    }

    const runIds = runs.map((r) => r.id);
    const runMap = new Map(runs.map((r) => [r.id, r]));

    // 4. Fetch responses for all runs
    const { data: responses } = await db
      .from("responses")
      .select("run_id, invite_token, question_id, value, created_at")
      .in("run_id", runIds);

    // 5. Fetch questions
    const { data: questions } = await db
      .from("questions")
      .select("id, dimension, prompt");

    const questionMap = new Map(
      (questions || []).map((q: { id: string; dimension: string; prompt: string }) => [q.id, q])
    );

    // 6. Build CSV
    const header = [
      "survey_title",
      "mode",
      "status",
      "created",
      "invite_token",
      "question_id",
      "dimension",
      "question_text",
      "value",
      "response_created_at",
    ];

    const lines = [header.join(",")];

    (responses || []).forEach((r: { run_id: string; invite_token: string; question_id: string; value: number; created_at: string }) => {
      const run = runMap.get(r.run_id);
      const q = questionMap.get(r.question_id);
      lines.push(
        [
          run?.title ?? "",
          run?.mode ?? "",
          run?.status ?? "",
          run?.opens_at ?? "",
          r.invite_token,
          r.question_id,
          q?.dimension ?? "",
          q?.prompt ?? "",
          r.value,
          r.created_at ?? "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    });

    const csv = lines.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trustgraph_surveys_export.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

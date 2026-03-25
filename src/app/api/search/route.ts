import { NextResponse } from "next/server";
import { requireAuth, apiOk } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return apiOk({ results: [] });

  const results: Array<{ type: string; title: string; href: string }> = [];

  // Search survey_runs
  const { data: surveys } = await auth.db
    .from("survey_runs")
    .select("id, title")
    .ilike("title", `%${q}%`)
    .limit(5);

  if (surveys) {
    for (const s of surveys) {
      results.push({ type: "Surveys", title: s.title, href: `/dashboard/surveys/${s.id}` });
    }
  }

  // Search trustsys_assessments
  const { data: assessments } = await auth.db
    .from("trustsys_assessments")
    .select("id, system_name")
    .ilike("system_name", `%${q}%`)
    .limit(5);

  if (assessments) {
    for (const a of assessments) {
      results.push({ type: "Assessments", title: a.system_name, href: `/trustsys/${a.id}` });
    }
  }

  // Search actions
  const { data: actions } = await auth.db
    .from("actions")
    .select("id, title")
    .ilike("title", `%${q}%`)
    .limit(5);

  if (actions) {
    for (const a of actions) {
      results.push({ type: "Actions", title: a.title, href: `/actions/${a.id}` });
    }
  }

  return apiOk({ results });
}

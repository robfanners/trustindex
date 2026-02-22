import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { hasPermission } from "@/lib/vcc/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";
import type { QuestionAnswer } from "@/lib/systemQuestionBank";
import { computeAllScores, computeRiskFlags } from "@/lib/systemScoring";
import { generateRecommendations } from "@/lib/systemRecommendations";
import type { RiskFlagItem } from "@/lib/vcc/types";

type RouteParams = { params: Promise<{ systemId: string; runId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/verisum-admin/systems/[systemId]/runs/[runId]
// Actions: recalculate | flag | unflag
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const auth = await requireAdmin("view_system_runs");
    if ("error" in auth) return auth.error;

    const { systemId, runId } = await context.params;
    const body = await request.json();
    const action = body.action as string;
    const reason = String(body.reason ?? "").trim();

    if (!["recalculate", "flag", "unflag"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'recalculate', 'flag', or 'unflag'" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Check action-specific permission
    const requiredPerm =
      action === "recalculate" ? "recalculate_scores" : "flag_risk";
    if (!hasPermission(auth.roles, requiredPerm)) {
      return NextResponse.json(
        { error: `Insufficient permission: ${requiredPerm}` },
        { status: 403 }
      );
    }

    const db = supabaseServer();

    // Verify run belongs to system
    const { data: run, error: runErr } = await db
      .from("system_runs")
      .select(
        "id, system_id, status, overall_score, dimension_scores, risk_flags"
      )
      .eq("id", runId)
      .eq("system_id", systemId)
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: "Run not found or does not belong to this system" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // RECALCULATE
    // -----------------------------------------------------------------------
    if (action === "recalculate") {
      if (run.status !== "submitted") {
        return NextResponse.json(
          { error: "Can only recalculate submitted runs" },
          { status: 409 }
        );
      }

      // Fetch all responses for this run
      const { data: responses, error: respErr } = await db
        .from("system_responses")
        .select("question_id, answer, evidence")
        .eq("run_id", runId);

      if (respErr) {
        return NextResponse.json(
          { error: respErr.message },
          { status: 500 }
        );
      }

      // Build answers map (same pattern as submit route)
      const answers: Record<string, QuestionAnswer> = {};
      for (const r of responses ?? []) {
        const answer: QuestionAnswer = r.answer as QuestionAnswer;
        if (r.evidence) {
          answer.evidence = r.evidence as QuestionAnswer["evidence"];
        }
        answers[r.question_id as string] = answer;
      }

      // Compute new scores
      const { dimensionScores, overall } = computeAllScores(answers);
      const computedFlags = computeRiskFlags(answers);
      const recommendations = generateRecommendations(answers);

      // Preserve admin-sourced flags
      const existingFlags = (run.risk_flags as RiskFlagItem[]) ?? [];
      const adminFlags = existingFlags.filter(
        (f) => f.source === "admin"
      );
      const taggedComputedFlags = computedFlags.map((f) => ({
        ...f,
        source: "computed" as const,
      }));
      const mergedFlags = [...taggedComputedFlags, ...adminFlags];

      // Delete existing recommendations and insert new
      await db
        .from("system_recommendations")
        .delete()
        .eq("run_id", runId);

      if (recommendations.length > 0) {
        const recRows = recommendations.map((r) => ({
          run_id: runId,
          question_id: r.questionId,
          dimension: r.dimension,
          control: r.control,
          priority: r.priority,
          recommendation: r.recommendation,
        }));
        await db.from("system_recommendations").insert(recRows);
      }

      // Update run
      const { error: updateErr } = await db
        .from("system_runs")
        .update({
          overall_score: overall,
          dimension_scores: dimensionScores,
          risk_flags: mergedFlags,
        })
        .eq("id", runId);

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 500 }
        );
      }

      await auditLog({
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        adminRoles: auth.roles,
        action: "system_run.recalculated",
        targetType: "system_run",
        targetId: runId,
        reason,
        beforeSnapshot: {
          overall_score: run.overall_score,
          risk_flags: run.risk_flags,
        },
        afterSnapshot: {
          overall_score: overall,
          risk_flags: mergedFlags,
        },
        metadata: {
          systemId,
          old_score: run.overall_score,
          new_score: overall,
          recommendations_count: recommendations.length,
        },
      });

      return NextResponse.json({
        data: {
          overall_score: overall,
          dimension_scores: dimensionScores,
          risk_flags: mergedFlags,
        },
      });
    }

    // -----------------------------------------------------------------------
    // FLAG
    // -----------------------------------------------------------------------
    if (action === "flag") {
      const flagLabel = String(body.flag_label ?? "Admin Flag").trim();
      const flagDescription = String(
        body.flag_description ?? "Flagged by admin"
      ).trim();

      const existingFlags = (run.risk_flags as RiskFlagItem[]) ?? [];

      // Check if already has admin flag
      if (existingFlags.some((f) => f.source === "admin")) {
        return NextResponse.json(
          { error: "Run already has an admin flag" },
          { status: 409 }
        );
      }

      const adminFlag: RiskFlagItem = {
        code: "ADMIN_FLAG",
        label: flagLabel,
        description: flagDescription,
        source: "admin",
      };

      const updatedFlags = [...existingFlags, adminFlag];

      const { error: updateErr } = await db
        .from("system_runs")
        .update({ risk_flags: updatedFlags })
        .eq("id", runId);

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 500 }
        );
      }

      await auditLog({
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        adminRoles: auth.roles,
        action: "system_run.risk_flagged",
        targetType: "system_run",
        targetId: runId,
        reason,
        beforeSnapshot: { risk_flags: existingFlags },
        afterSnapshot: { risk_flags: updatedFlags },
        metadata: { systemId, flag_label: flagLabel },
      });

      return NextResponse.json({ data: { risk_flags: updatedFlags } });
    }

    // -----------------------------------------------------------------------
    // UNFLAG
    // -----------------------------------------------------------------------
    if (action === "unflag") {
      const existingFlags = (run.risk_flags as RiskFlagItem[]) ?? [];
      const updatedFlags = existingFlags.filter(
        (f) => f.source !== "admin"
      );

      const { error: updateErr } = await db
        .from("system_runs")
        .update({ risk_flags: updatedFlags })
        .eq("id", runId);

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 500 }
        );
      }

      await auditLog({
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        adminRoles: auth.roles,
        action: "system_run.risk_unflagged",
        targetType: "system_run",
        targetId: runId,
        reason,
        beforeSnapshot: { risk_flags: existingFlags },
        afterSnapshot: { risk_flags: updatedFlags },
        metadata: { systemId },
      });

      return NextResponse.json({ data: { risk_flags: updatedFlags } });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

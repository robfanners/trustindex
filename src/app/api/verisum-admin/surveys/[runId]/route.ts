import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { hasPermission } from "@/lib/vcc/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";

// ---------------------------------------------------------------------------
// Token generation (same pattern as src/app/api/create-run/route.ts)
// ---------------------------------------------------------------------------

function randomToken(length = 28) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/surveys/[runId] — Survey detail + invites
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const auth = await requireAdmin("view_org_details");
    if ("error" in auth) return auth.error;

    const { runId } = await params;
    const db = supabaseServer();

    // Fetch survey run
    const { data: survey, error: survErr } = await db
      .from("survey_runs")
      .select(
        "id, title, mode, status, respondent_count, opens_at, created_at, owner_user_id, organisation_id"
      )
      .eq("id", runId)
      .single();

    if (survErr || !survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // Fetch invites and owner email in parallel
    const [invitesRes, profileRes] = await Promise.all([
      db
        .from("invites")
        .select("id, token, team, level, location")
        .eq("run_id", runId),
      survey.owner_user_id
        ? db
            .from("profiles")
            .select("email")
            .eq("id", survey.owner_user_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    return NextResponse.json({
      data: {
        id: survey.id,
        title: survey.title,
        mode: survey.mode,
        status: survey.status,
        respondent_count: survey.respondent_count,
        opens_at: survey.opens_at,
        created_at: survey.created_at,
        owner_user_id: survey.owner_user_id,
        owner_email: profileRes.data?.email ?? null,
        organisation_id: survey.organisation_id,
        invites: invitesRes.data ?? [],
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/verisum-admin/surveys/[runId] — Close survey or reset tokens
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const auth = await requireAdmin("view_org_details");
    if ("error" in auth) return auth.error;

    const { runId } = await params;
    const body = await request.json();
    const action = body.action as string;
    const reason = String(body.reason ?? "").trim();

    if (!["close", "reset_tokens"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'close' or 'reset_tokens'" },
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
      action === "close" ? "close_surveys" : "reset_tokens";
    if (!hasPermission(auth.roles, requiredPerm)) {
      return NextResponse.json(
        { error: `Insufficient permission: ${requiredPerm}` },
        { status: 403 }
      );
    }

    const db = supabaseServer();

    // Verify survey exists
    const { data: survey, error: survErr } = await db
      .from("survey_runs")
      .select("id, title, status")
      .eq("id", runId)
      .single();

    if (survErr || !survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // ----- Close action -----
    if (action === "close") {
      if (survey.status === "closed") {
        return NextResponse.json(
          { error: "Survey is already closed" },
          { status: 409 }
        );
      }

      const { data: updated, error: updateErr } = await db
        .from("survey_runs")
        .update({ status: "closed" })
        .eq("id", runId)
        .select("id, title, status")
        .single();

      if (updateErr || !updated) {
        return NextResponse.json(
          { error: updateErr?.message ?? "Failed to close survey" },
          { status: 500 }
        );
      }

      await auditLog({
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        adminRoles: auth.roles,
        action: "survey.closed",
        targetType: "survey",
        targetId: runId,
        reason,
        beforeSnapshot: { status: survey.status },
        afterSnapshot: { status: "closed" },
      });

      return NextResponse.json({ data: updated });
    }

    // ----- Reset tokens action -----
    if (action === "reset_tokens") {
      // Fetch all invites for this run
      const { data: invites, error: invErr } = await db
        .from("invites")
        .select("id, token")
        .eq("run_id", runId);

      if (invErr) {
        return NextResponse.json(
          { error: invErr.message },
          { status: 500 }
        );
      }

      if (!invites || invites.length === 0) {
        return NextResponse.json(
          { error: "No invites found for this survey" },
          { status: 404 }
        );
      }

      // Generate new tokens and update each invite
      const oldTokens: string[] = [];
      for (const invite of invites) {
        oldTokens.push(invite.token as string);
        const newToken = randomToken(28);
        await db
          .from("invites")
          .update({ token: newToken })
          .eq("id", invite.id);
      }

      await auditLog({
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        adminRoles: auth.roles,
        action: "survey.tokens_reset",
        targetType: "survey",
        targetId: runId,
        reason,
        beforeSnapshot: { invite_count: invites.length },
        afterSnapshot: { invite_count: invites.length, tokens_regenerated: true },
        metadata: {
          invite_ids: invites.map((i) => i.id),
          invite_count: invites.length,
        },
      });

      return NextResponse.json({
        data: { reset_count: invites.length },
      });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

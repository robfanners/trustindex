export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canGeneratePack } from "@/lib/entitlements";
import { generateText } from "@/lib/llm";
import {
  GOVERNANCE_STATEMENT_SYSTEM,
  buildGovernanceStatementPrompt,
  GAP_ANALYSIS_SYSTEM,
  buildGapAnalysisPrompt,
  type WizardResponses,
} from "@/lib/governancePrompts";

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // ── Plan check ───────────────────────────────────────────────────
    const plan = await getUserPlan(user.id);
    if (!canGeneratePack(plan)) {
      return NextResponse.json(
        { error: "Upgrade to generate governance packs" },
        { status: 403 }
      );
    }

    // ── Org lookup ───────────────────────────────────────────────────
    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 400 }
      );
    }

    // ── Parse request ────────────────────────────────────────────────
    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return NextResponse.json(
        { error: "wizardId is required" },
        { status: 400 }
      );
    }

    // ── Load wizard responses ────────────────────────────────────────
    const { data: wizard, error: wizardError } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("id", wizardId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (wizardError || !wizard) {
      console.error("[pack] Error loading wizard run:", wizardError);
      return NextResponse.json(
        { error: "Wizard run not found" },
        { status: 404 }
      );
    }

    const responses = wizard.responses as WizardResponses;
    if (!responses?.company || !responses?.controls) {
      return NextResponse.json(
        { error: "Wizard responses are incomplete" },
        { status: 400 }
      );
    }

    // ── Version number ───────────────────────────────────────────────
    const { count } = await sb
      .from("governance_packs")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    const version = (count ?? 0) + 1;

    // ── Create pack row (status: generating) ─────────────────────────
    const { data: pack, error: insertError } = await sb
      .from("governance_packs")
      .insert({
        organisation_id: profile.organisation_id,
        wizard_id: wizardId,
        version,
        status: "generating",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !pack) {
      console.error("[pack] Error creating pack row:", insertError);
      return NextResponse.json(
        { error: "Failed to create governance pack" },
        { status: 500 }
      );
    }

    const packId = pack.id as string;

    try {
      // ── 1. Generate governance statement ─────────────────────────────
      console.log("[pack] Generating governance statement for pack", packId);
      const statementPrompt = buildGovernanceStatementPrompt(responses, version);
      const statementContent = await generateText(
        GOVERNANCE_STATEMENT_SYSTEM,
        [{ role: "user", content: statementPrompt }],
        { maxTokens: 4096, temperature: 0.3 }
      );

      // ── 2. Build usage inventory ─────────────────────────────────────
      console.log("[pack] Building usage inventory for pack", packId);
      const { data: vendors } = await sb
        .from("ai_vendors")
        .select("vendor_name, risk_category, data_types, notes, source")
        .eq("organisation_id", profile.organisation_id);

      const inventoryJson = {
        generatedAt: new Date().toISOString(),
        company: responses.company,
        tools: responses.tools,
        additionalVendors: vendors ?? [],
      };

      // ── 3. Generate gap analysis ─────────────────────────────────────
      console.log("[pack] Generating gap analysis for pack", packId);
      const gapPrompt = buildGapAnalysisPrompt(responses);
      const gapContent = await generateText(
        GAP_ANALYSIS_SYSTEM,
        [{ role: "user", content: gapPrompt }],
        { maxTokens: 4096, temperature: 0.3 }
      );

      // ── Update pack with results ─────────────────────────────────────
      const { data: updatedPack, error: updateError } = await sb
        .from("governance_packs")
        .update({
          statement_md: statementContent,
          inventory_json: inventoryJson,
          gap_analysis_md: gapContent,
          status: "ready",
          generated_at: new Date().toISOString(),
        })
        .eq("id", packId)
        .select()
        .single();

      if (updateError) {
        console.error("[pack] Error updating pack with results:", updateError);
        return NextResponse.json(
          { error: "Failed to save governance pack" },
          { status: 500 }
        );
      }

      console.log("[pack] Pack generated successfully:", packId);
      return NextResponse.json({ pack: updatedPack });
    } catch (genError: unknown) {
      // Generation failed — mark pack as failed
      console.error("[pack] Generation failed for pack", packId, genError);
      await sb
        .from("governance_packs")
        .update({ status: "failed" })
        .eq("id", packId);

      return NextResponse.json(
        {
          error:
            genError instanceof Error
              ? genError.message
              : "Generation failed",
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[pack] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

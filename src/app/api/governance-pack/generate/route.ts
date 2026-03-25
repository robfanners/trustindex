export const runtime = "nodejs";
export const maxDuration = 120;

import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canGeneratePack } from "@/lib/entitlements";
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
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;
    const { user, orgId, plan, db: sb } = auth;

    // ── Plan check ───────────────────────────────────────────────────
    if (!canGeneratePack(plan)) {
      return apiError("Upgrade to generate governance packs", 403);
    }

    // ── Parse request ────────────────────────────────────────────────
    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return apiError("wizardId is required", 400);
    }

    // ── Load wizard responses ────────────────────────────────────────
    const { data: wizard, error: wizardError } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("id", wizardId)
      .eq("organisation_id", orgId)
      .single();

    if (wizardError || !wizard) {
      console.error("[pack] Error loading wizard run:", wizardError);
      return apiError("Wizard run not found", 404);
    }

    const responses = wizard.responses as WizardResponses;
    if (!responses?.company || !responses?.controls) {
      return apiError("Wizard responses are incomplete", 400);
    }

    // ── Version number ───────────────────────────────────────────────
    const { count } = await sb
      .from("governance_packs")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    const version = (count ?? 0) + 1;

    // ── Create pack row (status: generating) ─────────────────────────
    const { data: pack, error: insertError } = await sb
      .from("governance_packs")
      .insert({
        organisation_id: orgId,
        wizard_id: wizardId,
        version,
        status: "generating",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !pack) {
      console.error("[pack] Error creating pack row:", insertError);
      return apiError("Failed to create governance pack", 500);
    }

    const packId = pack.id as string;

    try {
      // ── 1. Generate governance statement ─────────────────────────────
      const statementPrompt = buildGovernanceStatementPrompt(responses, version);
      const statementContent = await generateText(
        GOVERNANCE_STATEMENT_SYSTEM,
        [{ role: "user", content: statementPrompt }],
        { maxTokens: 4096, temperature: 0.3 }
      );

      // ── 2. Build usage inventory ─────────────────────────────────────
      const { data: vendors } = await sb
        .from("ai_vendors")
        .select("vendor_name, risk_category, data_types, notes, source")
        .eq("organisation_id", orgId);

      // Fetch active IBG specs for the org's systems
      const { data: ibgSpecs } = await sb
        .from("ibg_specifications")
        .select("authorised_goals, decision_authorities, action_spaces, blast_radius, assessment_id, version, status, effective_from")
        .eq("organisation_id", orgId)
        .eq("status", "active");

      let ibgInventory: Record<string, unknown>[] = [];
      if (ibgSpecs && ibgSpecs.length > 0) {
        const assessmentIds = ibgSpecs.map((s) => s.assessment_id);
        const { data: assessments } = await sb
          .from("trustsys_assessments")
          .select("id, name, type")
          .in("id", assessmentIds);

        const assessmentMap = new Map(
          (assessments ?? []).map((a) => [a.id, a])
        );

        ibgInventory = ibgSpecs.map((s) => {
          const assessment = assessmentMap.get(s.assessment_id);
          return {
            systemName: assessment?.name ?? "Unknown System",
            systemType: assessment?.type ?? "AI System",
            version: s.version,
            status: s.status,
            effectiveFrom: s.effective_from,
            authorisedGoals: s.authorised_goals,
            decisionAuthorities: s.decision_authorities,
            actionSpaces: s.action_spaces,
            blastRadius: s.blast_radius,
          };
        });
      }

      const inventoryJson = {
        generatedAt: new Date().toISOString(),
        company: responses.company,
        tools: responses.tools,
        additionalVendors: vendors ?? [],
        ibgSpecifications: ibgInventory,
      };

      // ── 3. Generate gap analysis ─────────────────────────────────────
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
        return apiError("Failed to save governance pack", 500);
      }

      return apiOk({ pack: updatedPack });
    } catch (genError: unknown) {
      // Generation failed — mark pack as failed
      console.error("[pack] Generation failed for pack", packId, genError);
      await sb
        .from("governance_packs")
        .update({ status: "failed" })
        .eq("id", packId);

      return apiError(
        genError instanceof Error ? genError.message : "Generation failed",
        500
      );
    }
  } catch (err: unknown) {
    console.error("[pack] Unexpected error:", err);
    return apiError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}

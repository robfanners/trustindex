import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canGeneratePolicy } from "@/lib/entitlements";
import { generateText } from "@/lib/llm";
import { SYSTEM_PROMPT, buildPolicyPrompt } from "@/lib/policyPrompts";
import type { PolicyType, PolicyQuestionnaire } from "@/lib/policyPrompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Auth
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Plan check
    const plan = await getUserPlan(user.id);
    if (!canGeneratePolicy(plan)) {
      return NextResponse.json(
        { error: "Upgrade to generate AI policies" },
        { status: 403 }
      );
    }

    // Parse request
    const body = await req.json();
    const policyType = body.policyType as PolicyType;
    const questionnaire = body.questionnaire as PolicyQuestionnaire;

    if (!policyType || !questionnaire?.companyName) {
      return NextResponse.json(
        { error: "Missing policyType or questionnaire" },
        { status: 400 }
      );
    }

    // Get org
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

    // Generate policy via LLM
    const prompt = buildPolicyPrompt(policyType, questionnaire);
    const content = await generateText(SYSTEM_PROMPT, [
      { role: "user", content: prompt },
    ]);

    // Get current version number
    const { count } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .eq("policy_type", policyType);

    const version = (count ?? 0) + 1;

    // Save to DB
    const { data: policy, error } = await sb
      .from("ai_policies")
      .insert({
        organisation_id: profile.organisation_id,
        policy_type: policyType,
        version,
        content,
        questionnaire,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[copilot] Error saving policy:", error);
      return NextResponse.json(
        { error: "Failed to save policy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ policy });
  } catch (err: unknown) {
    console.error("[copilot] generate-policy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

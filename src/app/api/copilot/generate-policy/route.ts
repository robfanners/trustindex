import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canGeneratePolicy, maxPolicyGenerations } from "@/lib/entitlements";
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

    // Rate limit check
    const limit = maxPolicyGenerations(plan);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .gte("created_at", startOfMonth.toISOString());

    const used = monthlyCount ?? 0;
    if (used >= limit) {
      return NextResponse.json(
        {
          error: `You've used all ${limit} policy generation${limit !== 1 ? "s" : ""} this month. Upgrade for more.`,
          remaining: 0,
          limit,
        },
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

    // Generate policy via LLM
    let content: string;
    try {
      const prompt = buildPolicyPrompt(policyType, questionnaire);
      content = await generateText(SYSTEM_PROMPT, [
        { role: "user", content: prompt },
      ]);
    } catch (llmErr: unknown) {
      console.error("[copilot] LLM generation failed:", llmErr);
      return NextResponse.json(
        { error: "Policy generation is temporarily unavailable. Please try again in a few minutes." },
        { status: 503 }
      );
    }

    // Get current version number
    const { count: versionCount } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .eq("policy_type", policyType);

    const version = (versionCount ?? 0) + 1;

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

    return NextResponse.json({
      policy,
      remaining: limit - (used + 1),
      limit,
    });
  } catch (err: unknown) {
    console.error("[copilot] generate-policy error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

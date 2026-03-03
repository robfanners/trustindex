import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isPaidPlan } from "@/lib/entitlements";
import { sendEmail } from "@/lib/email";
import { declarationInviteEmail } from "@/lib/emailTemplates";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id, plan, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id || !isPaidPlan(profile.plan)) {
      return NextResponse.json({ error: "Not available" }, { status: 403 });
    }

    const body = await req.json();
    const { tokenId, emails } = body as { tokenId: string; emails: string[] };

    if (!tokenId || !emails?.length) {
      return NextResponse.json({ error: "tokenId and emails required" }, { status: 400 });
    }

    // Validate token belongs to org
    const { data: token } = await sb
      .from("declaration_tokens")
      .select("id, token, label, organisation_id")
      .eq("id", tokenId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Get org name
    const { data: org } = await sb
      .from("organisations")
      .select("name")
      .eq("id", profile.organisation_id)
      .single();

    const origin = getServerOrigin(req);
    const declarationUrl = `${origin}/declare/${token.token}`;
    const orgName = org?.name ?? "Your organisation";

    // Build email
    const { subject, html } = declarationInviteEmail({
      orgName,
      campaignLabel: token.label ?? "",
      declarationUrl,
      senderName: profile.full_name ?? undefined,
    });

    // Send emails and create invite records
    const validEmails = emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes("@"));

    let sentCount = 0;
    for (const email of validEmails) {
      try {
        await sendEmail({ to: email, subject, html });

        await sb.from("declaration_invites").insert({
          token_id: tokenId,
          email,
        });

        sentCount++;
      } catch (emailErr) {
        console.error(`[declarations] Failed to send invite to ${email}:`, emailErr);
      }
    }

    return NextResponse.json({ sent: sentCount, total: validEmails.length });
  } catch (err: unknown) {
    console.error("[declarations] invite error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { isPaidPlan } from "@/lib/entitlements";
import { sendEmail } from "@/lib/email";
import { declarationInviteEmail } from "@/lib/emailTemplates";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;

    if (!isPaidPlan(auth.plan)) {
      return apiError("Not available", 403);
    }

    // Get full_name for email
    const { data: profile } = await auth.db
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .single();

    const body = await req.json();
    const { tokenId, emails } = body as { tokenId: string; emails: string[] };

    if (!tokenId || !emails?.length) {
      return apiError("tokenId and emails required", 400);
    }

    // Validate token belongs to org
    const { data: token } = await auth.db
      .from("declaration_tokens")
      .select("id, token, label, organisation_id")
      .eq("id", tokenId)
      .eq("organisation_id", auth.orgId)
      .single();

    if (!token) {
      return apiError("Token not found", 404);
    }

    // Get org name
    const { data: org } = await auth.db
      .from("organisations")
      .select("name")
      .eq("id", auth.orgId)
      .single();

    const origin = getServerOrigin(req);
    const declarationUrl = `${origin}/declare/${token.token}`;
    const orgName = org?.name ?? "Your organisation";

    // Build email
    const { subject, html } = declarationInviteEmail({
      orgName,
      campaignLabel: token.label ?? "",
      declarationUrl,
      senderName: profile?.full_name ?? undefined,
    });

    // Send emails and create invite records
    const validEmails = emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes("@"));

    let sentCount = 0;
    for (const email of validEmails) {
      try {
        await sendEmail({ to: email, subject, html });

        await auth.db.from("declaration_invites").insert({
          token_id: tokenId,
          email,
        });

        sentCount++;
      } catch (emailErr) {
        console.error(`[declarations] Failed to send invite to ${email}:`, emailErr);
      }
    }

    return apiOk({ sent: sentCount, total: validEmails.length });
  } catch (err: unknown) {
    console.error("[declarations] invite error:", err);
    return apiError(err instanceof Error ? err.message : "Internal server error", 500);
  }
}

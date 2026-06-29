import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/vcc/audit";
import { sendEmail } from "@/lib/email";
import { supportMagicLinkEmail } from "@/lib/emailTemplates";
import { getServerOrigin } from "@/lib/url";

// ---------------------------------------------------------------------------
// POST /api/verisum-admin/organisations/[orgId]/resend-magic-link
//
// Admin-triggered magic link resend, for when a customer can't access their
// account. Generates a fresh magic link via Supabase Auth admin and sends it
// via our Resend with a branded "Verisum Support" template. Audit-logged.
//
// Note: in this codebase `orgId` in admin URLs maps to `profiles.id` (the
// user). We follow the same pattern as the plan-change endpoint.
// ---------------------------------------------------------------------------

const MAGIC_LINK_EXPIRY_MINUTES = 60; // Supabase default

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("resend_magic_link");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const db = supabaseServer();

    // Look up the customer profile
    const { data: profile, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", orgId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!profile.email) {
      return NextResponse.json(
        { error: "Customer has no email on file" },
        { status: 400 }
      );
    }

    // Generate a fresh magic link via Supabase Auth admin.
    // The action_link returned will land at /auth/callback (after Supabase
    // verifies the token) so our existing org-ensure + auth flow runs.
    const origin = getServerOrigin(request);
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink(
      {
        type: "magiclink",
        email: profile.email,
        options: {
          redirectTo: `${origin}/auth/callback?next=/dashboard`,
        },
      }
    );

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[admin/resend-magic-link] generateLink failed:", linkErr);
      return NextResponse.json(
        { error: "Failed to generate sign-in link" },
        { status: 500 }
      );
    }

    const magicLinkUrl = linkData.properties.action_link;
    const userName =
      (profile.full_name as string | null)?.trim() ||
      profile.email.split("@")[0];

    // Send via our Resend — branded "Support sent you a link" email.
    const { subject, html } = supportMagicLinkEmail({
      userName,
      magicLinkUrl,
      expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
      adminName: auth.user.email,
    });

    try {
      await sendEmail({ to: profile.email, subject, html });
    } catch (e) {
      console.error("[admin/resend-magic-link] sendEmail failed:", e);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    // Audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "org.magic_link_resent",
      targetType: "organisation",
      targetId: orgId,
      reason,
      metadata: {
        sent_to: profile.email,
        expires_in_minutes: MAGIC_LINK_EXPIRY_MINUTES,
      },
    });

    return NextResponse.json({
      data: { sent_to: profile.email },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/resend-magic-link] unhandled error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Transactional email templates for the AI Governance Copilot.
 *
 * All templates return { subject, html } ready for sendEmail().
 * Templates use inline styles for maximum email client compatibility.
 */

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

const BRAND_COLOR = "#2563eb";
const MUTED_COLOR = "#6b7280";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <div style="margin-bottom:24px;">
        <span style="font-size:18px;font-weight:700;color:#111827;">Verisum</span>
        <span style="font-size:12px;color:${MUTED_COLOR};margin-left:8px;">AI Governance Copilot</span>
      </div>
      <h1 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 16px 0;">${title}</h1>
      ${body}
    </div>
    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:12px;color:${MUTED_COLOR};">
        Sent by Verisum AI Governance Copilot<br />
        <a href="https://verisum.org" style="color:${BRAND_COLOR};text-decoration:none;">verisum.org</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;margin:8px 0;">${text}</a>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Welcome email — sent after first sign-up.
 *
 * Plan-aware: Explorer (free) gets free-assessment framing; paid tiers
 * (Core / Assure / Verify) get "what's now active" framing.
 */
export function welcomeEmail(params: {
  userName: string;
  plan: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const { userName, plan, dashboardUrl } = params;

  // Internal plan keys → customer-facing labels
  const PLAN_LABELS: Record<string, string> = {
    explorer: "Explorer",
    starter: "Core",
    pro: "Assure",
    enterprise: "Verify",
  };
  const planLabel = PLAN_LABELS[plan] ?? "Explorer";
  const isExplorer = plan === "explorer";

  const featureList = isExplorer
    ? `
      <ul style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;">
        <li>Run a free trust self-assessment in under 3 minutes</li>
        <li>See your governance baseline across 5 dimensions</li>
        <li>Save your results to your dashboard</li>
        <li>Upgrade to Core when you're ready for the full governance bundle</li>
      </ul>
    `
    : `
      <ul style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;">
        <li>Run organisational trust surveys with your team</li>
        <li>Assess AI systems against governance dimensions</li>
        <li>Generate tailored AI governance policies</li>
        <li>Track AI vendors and log incidents</li>
        <li>Export results to CSV for board reporting</li>
      </ul>
    `;

  const nextStepCopy = isExplorer
    ? `Get started with your free self-assessment, or explore your dashboard:`
    : `Run the governance setup wizard to configure your bundle:`;

  return {
    subject: `Welcome to Verisum ${planLabel}`,
    html: layout(
      `Welcome to Verisum, ${userName}!`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        You're now on the <strong>${planLabel}</strong> plan. Here's what's available:
      </p>
      ${featureList}
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        ${nextStepCopy}
      </p>
      ${button("Open Dashboard", dashboardUrl)}
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        Need help? Reply to this email — we'll get back to you.
      </p>
      `
    ),
  };
}

/**
 * Support-sent magic link — fired by Verisum admin when a customer needs
 * help getting back into their account. Looks like a "we sent you a link"
 * support touchpoint rather than a routine auth email.
 */
export function supportMagicLinkEmail(params: {
  userName: string;
  magicLinkUrl: string;
  expiresInMinutes: number;
  adminName?: string;
}): { subject: string; html: string } {
  const { userName, magicLinkUrl, expiresInMinutes, adminName } = params;
  const fromLine = adminName ? `${adminName} from Verisum Support` : "Verisum Support";

  return {
    subject: `Your Verisum sign-in link`,
    html: layout(
      `Sign-in link from Verisum Support`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        Hi ${userName},
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        ${fromLine} has sent you a fresh sign-in link. Click below to access your
        Verisum account — the link is valid for ${expiresInMinutes} minutes.
      </p>
      ${button("Sign in to Verisum", magicLinkUrl)}
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        If you didn't request this, you can safely ignore this email — the link
        will expire automatically. Reply to this email if you need help.
      </p>
      `
    ),
  };
}

/**
 * Monthly report delivery email — sent with compliance report.
 */
export function monthlyReportEmail(params: {
  orgName: string;
  month: string;
  healthScore: number | null;
  incidentCount: number;
  vendorCount: number;
  declarationCount: number;
  reportUrl: string;
}): { subject: string; html: string } {
  const { orgName, month, healthScore, incidentCount, vendorCount, declarationCount, reportUrl } =
    params;

  return {
    subject: `${orgName} — AI Governance Report for ${month}`,
    html: layout(
      `Monthly Compliance Report`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        Here's your AI governance summary for <strong>${orgName}</strong> — ${month}.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;font-size:14px;color:#374151;">
          ${healthScore !== null ? `<tr><td style="padding:4px 0;">Trust Health</td><td style="text-align:right;font-weight:600;">${healthScore.toFixed(1)}/100</td></tr>` : ""}
          <tr><td style="padding:4px 0;">AI Vendors tracked</td><td style="text-align:right;font-weight:600;">${vendorCount}</td></tr>
          <tr><td style="padding:4px 0;">Staff declarations</td><td style="text-align:right;font-weight:600;">${declarationCount}</td></tr>
          <tr><td style="padding:4px 0;">Incidents logged</td><td style="text-align:right;font-weight:600;">${incidentCount}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        Your full compliance report is ready to download:
      </p>
      ${button("Download Report (PDF)", reportUrl)}
      `
    ),
  };
}

/**
 * Declaration reminder — sent 3 days after token creation if few responses.
 */
export function declarationReminderEmail(params: {
  orgName: string;
  declarationUrl: string;
  responseCount: number;
}): { subject: string; html: string } {
  const { orgName, declarationUrl, responseCount } = params;

  return {
    subject: `Reminder: Complete your AI usage declaration for ${orgName}`,
    html: layout(
      `AI Declaration Reminder`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        ${orgName} is collecting AI usage declarations to support responsible AI governance.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        So far, <strong>${responseCount}</strong> declaration${responseCount !== 1 ? "s have" : " has"} been submitted.
        If you haven't already, please take 2 minutes to declare your AI tool usage:
      </p>
      ${button("Submit Declaration", declarationUrl)}
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        This declaration is anonymous and helps your organisation maintain responsible AI practices.
      </p>
      `
    ),
  };
}

/**
 * Policy ready notification — sent when AI policy generation completes.
 */
export function policyReadyEmail(params: {
  userName: string;
  policyType: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const { userName, policyType, dashboardUrl } = params;

  const POLICY_LABELS: Record<string, string> = {
    acceptable_use: "Acceptable Use Policy",
    data_handling: "Data Handling Addendum",
    staff_guidelines: "Staff Guidelines",
  };

  const label = POLICY_LABELS[policyType] ?? policyType;

  return {
    subject: `Your ${label} is ready — Verisum AI Governance Copilot`,
    html: layout(
      `Your ${label} is ready`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        Hi ${userName}, your <strong>${label}</strong> has been generated and is ready for review.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        We recommend reviewing the policy with your leadership team before adopting it. You can edit and regenerate the policy at any time from your Copilot dashboard.
      </p>
      ${button("View Policy", dashboardUrl)}
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        This policy was generated by AI and should be reviewed by a qualified professional before formal adoption.
      </p>
      `
    ),
  };
}

/**
 * Declaration invite — sent to staff asking them to complete AI usage declaration.
 */
export function declarationInviteEmail(params: {
  orgName: string;
  campaignLabel: string;
  declarationUrl: string;
  senderName?: string;
}): { subject: string; html: string } {
  const { orgName, campaignLabel, declarationUrl, senderName } = params;

  return {
    subject: `AI Usage Declaration — ${orgName}`,
    html: layout(
      `AI Usage Declaration`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        ${senderName ? `${senderName} from ` : ""}${orgName} is asking you to complete a brief AI usage declaration
        ${campaignLabel ? ` as part of <strong>${campaignLabel}</strong>` : ""}.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        This helps your organisation understand how AI tools are being used and ensure responsible AI governance.
        It takes about <strong>2\u20133 minutes</strong> to complete.
      </p>
      ${button("Complete Declaration", declarationUrl)}
      <p style="font-size:14px;color:#374151;line-height:1.6;margin-top:16px;">
        <strong>What you\u2019ll be asked:</strong>
      </p>
      <ul style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;">
        <li>Which AI tools you use (e.g. ChatGPT, Copilot, Claude)</li>
        <li>What you use them for</li>
        <li>What types of data you input</li>
      </ul>
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        Your responses help build a clear picture of AI usage across ${orgName}. If you have questions, contact your line manager or IT team.
      </p>
      `
    ),
  };
}

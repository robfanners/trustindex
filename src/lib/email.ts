/**
 * Transactional email utility using Resend.
 *
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL in env.
 * Falls back gracefully if not configured (logs warning, does not throw).
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured — emails will be skipped");
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

/**
 * Send a transactional email via Resend.
 * Returns the Resend response or null if email is not configured.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions) {
  const resend = getResend();
  if (!resend) return null;

  const from = process.env.RESEND_FROM_EMAIL || "noreply@verisum.org";

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  if (error) {
    console.error("[email] Send failed:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

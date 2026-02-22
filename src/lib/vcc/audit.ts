// ---------------------------------------------------------------------------
// VCC — Immutable audit log writer
// ---------------------------------------------------------------------------
// Writes to the vcc_audit_log table after every successful admin operation.
// Logs but does not throw on failure (audit failure shouldn't block ops).
// ---------------------------------------------------------------------------

import { supabaseServer } from "@/lib/supabaseServer";
import type { AdminRole } from "./permissions";
import { primaryRole } from "./permissions";

export type AuditEntry = {
  adminUserId: string;
  adminEmail: string;
  adminRoles: AdminRole[];
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Write an immutable audit log entry.
 * Should be called after every successful write operation in VCC API routes.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("vcc_audit_log").insert({
    admin_user_id: entry.adminUserId,
    admin_email: entry.adminEmail,
    admin_role: primaryRole(entry.adminRoles),
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    reason: entry.reason,
    before_snapshot: entry.beforeSnapshot ?? null,
    after_snapshot: entry.afterSnapshot ?? null,
    metadata: entry.metadata ?? null,
  });

  if (error) {
    console.error("[vcc-audit] Failed to write audit log:", error.message);
  }
}

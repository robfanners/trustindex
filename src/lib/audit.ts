// ---------------------------------------------------------------------------
// Shared audit log writer — org-level operations
// ---------------------------------------------------------------------------
// Writes to the audit_logs table (created in migration 008, immutable via DB
// triggers). Follows the same fire-and-forget pattern as lib/vcc/audit.ts.
// Logs but does not throw on failure (audit failure shouldn't block ops).
// ---------------------------------------------------------------------------

import { supabaseServer } from "@/lib/supabaseServer";

export type AuditLogEntry = {
  organisationId: string;
  entityType: string; // signal | escalation | incident | action | attestation | approval | provenance | incident_lock | exchange
  entityId: string;
  actionType: string; // created | resolved | status_change | decided | updated
  performedBy: string; // user ID
  metadata?: Record<string, unknown> | null;
};

/**
 * Write an immutable audit log entry for an org-level operation.
 * Should be called after every successful write operation in API routes.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("audit_logs").insert({
    organisation_id: entry.organisationId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action_type: entry.actionType,
    performed_by: entry.performedBy,
    metadata: entry.metadata ?? null,
  });

  if (error) {
    console.error("[audit-log] Failed to write:", error.message);
  }
}

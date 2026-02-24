"use client";

import { useAuth } from "@/context/AuthContext";
import { canManageTeam } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// /dashboard/settings/team — Team Management (Enterprise only)
// ---------------------------------------------------------------------------

export default function TeamSettingsPage() {
  const { user, profile } = useAuth();

  // Plan gate: only Enterprise
  if (!canManageTeam(profile?.plan)) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Team Management</h2>
        <p className="text-sm text-muted-foreground">
          Team management is available on the Enterprise plan. Add admins,
          manage roles, and transfer ownership.
        </p>
        <a
          href="/upgrade"
          className="inline-block px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover"
        >
          View Enterprise plan
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Owner info */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Team Management</h2>

        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
              Owner
            </span>
          </div>
        </div>
      </div>

      {/* Roles info */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Roles</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Owner</span>
            <span>— Full access to all settings and data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Admin</span>
            <span>— Can manage surveys and systems</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Viewer</span>
            <span className="italic">— Coming soon</span>
          </div>
        </div>
      </div>

      {/* Actions — coming soon */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Add team member
          </button>
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Transfer ownership
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Team member management and ownership transfer are coming in a future update.
        </p>
      </div>
    </div>
  );
}

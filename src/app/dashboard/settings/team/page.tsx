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
      <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-verisum-black">Team Management</h2>
        <p className="text-sm text-verisum-grey">
          Team management is available on the Enterprise plan. Add admins,
          manage roles, and transfer ownership.
        </p>
        <a
          href="/upgrade"
          className="inline-block px-4 py-2 rounded bg-verisum-blue text-verisum-white text-sm font-semibold hover:bg-[#2a7bb8]"
        >
          View Enterprise plan
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Owner info */}
      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-verisum-black">Team Management</h2>

        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-verisum-grey">Owner:</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-verisum-blue/10 text-verisum-blue font-medium">
              Owner
            </span>
          </div>
        </div>
      </div>

      {/* Roles info */}
      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-verisum-black">Roles</h2>
        <div className="text-sm text-verisum-grey space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-verisum-black">Owner</span>
            <span>— Full access to all settings and data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-verisum-black">Admin</span>
            <span>— Can manage surveys and systems</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-verisum-black">Viewer</span>
            <span className="italic">— Coming soon</span>
          </div>
        </div>
      </div>

      {/* Actions — coming soon */}
      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-verisum-black">Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button
            disabled
            className="px-4 py-2 rounded border border-verisum-grey text-sm text-verisum-grey cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Add team member
          </button>
          <button
            disabled
            className="px-4 py-2 rounded border border-verisum-grey text-sm text-verisum-grey cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Transfer ownership
          </button>
        </div>

        <p className="text-xs text-verisum-grey">
          Team member management and ownership transfer are coming in a future update.
        </p>
      </div>
    </div>
  );
}

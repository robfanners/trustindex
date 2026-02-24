"use client";

import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// /dashboard/settings/security — Security settings
// ---------------------------------------------------------------------------

export default function SecuritySettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="space-y-6">
      {/* Current session */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Current session</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd className="font-medium">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>

        <button
          onClick={signOut}
          className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Two-factor authentication */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Two-factor authentication
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Add an extra layer of security to your account with two-factor
          authentication (2FA). This feature is coming in a future update.
        </p>
        <button
          disabled
          className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
        >
          Enable 2FA
        </button>
      </div>

      {/* Active sessions */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Active sessions</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          View and manage your active sessions across devices. This feature is
          coming in a future update.
        </p>
        <button
          disabled
          className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
        >
          View active sessions
        </button>
      </div>

      {/* Reset tokens */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Security tokens</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Reset survey admin codes and system access tokens. This feature is
          coming in a future update.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
          >
            Reset survey admin codes
          </button>
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
          >
            Reset system access tokens
          </button>
        </div>
      </div>
    </div>
  );
}

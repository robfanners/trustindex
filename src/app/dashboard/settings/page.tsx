"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPlanLimits, hasBillingAccess } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// /dashboard/settings — Account Overview
// ---------------------------------------------------------------------------

export default function AccountSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const limits = getPlanLimits(profile?.plan);

  // Usage counts
  const [surveyCount, setSurveyCount] = useState<number | null>(null);
  const [systemCount, setSystemCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/my-surveys")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSurveyCount((d.surveys || []).length))
      .catch(() => {});
    fetch("/api/systems")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSystemCount((d.systems || []).length))
      .catch(() => {});
  }, []);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [role, setRole] = useState("");

  // Populate fields when profile loads or editing starts
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCompanyName(profile.company_name ?? "");
      setCompanySize(profile.company_size ?? "");
      setRole(profile.role ?? "");
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          company_size: companySize.trim(),
          role: role.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveMsg(d.error || "Failed to save");
      } else {
        setSaveMsg("Profile updated");
        setEditing(false);
        await refreshProfile();
      }
    } catch {
      setSaveMsg("Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [fullName, companyName, companySize, role, refreshProfile]);

  const handleManageBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Could not open billing portal.");
    }
  }, []);

  const planLabel = profile?.plan ?? "explorer";
  const hasSubscription = !!profile?.stripe_subscription_id;

  return (
    <div className="space-y-6">
      {/* Account info card */}
      <div className="border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Account information
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-brand hover:text-foreground transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Full name</label>
              <input
                className="w-full border border-border rounded px-3 py-2 text-sm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Organisation name</label>
              <input
                className="w-full border border-border rounded px-3 py-2 text-sm"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company or organisation"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Organisation size</label>
              <input
                className="w-full border border-border rounded px-3 py-2 text-sm"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="e.g. 1-10, 11-50, 51-200, 200+"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <input
                className="w-full border border-border rounded px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. CTO, Head of Trust, GRC Lead"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setSaveMsg(null);
                  // Reset to profile values
                  setFullName(profile?.full_name ?? "");
                  setCompanyName(profile?.company_name ?? "");
                  setCompanySize(profile?.company_size ?? "");
                  setRole(profile?.role ?? "");
                }}
                className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
            {saveMsg && (
              <div
                className={`text-sm ${
                  saveMsg === "Profile updated" ? "text-success" : "text-destructive"
                }`}
              >
                {saveMsg}
              </div>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium">{profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organisation</dt>
              <dd className="font-medium">{profile?.company_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organisation size</dt>
              <dd className="font-medium">{profile?.company_size || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{profile?.role || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account created</dt>
              <dd className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Plan & usage card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Plan & usage</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Current plan</dt>
            <dd className="font-medium capitalize flex items-center gap-2">
              {planLabel}
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium capitalize">
                {planLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Surveys used</dt>
            <dd className="font-medium">
              {surveyCount !== null
                ? `${surveyCount} of ${limits.maxSurveys === Infinity ? "∞" : limits.maxSurveys}`
                : "Loading..."}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Systems assessed</dt>
            <dd className="font-medium">
              {systemCount !== null
                ? `${systemCount} of ${limits.maxSystems === Infinity ? "∞" : limits.maxSystems}`
                : "Loading..."}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {planLabel !== "enterprise" && (
            <a
              href="/upgrade"
              className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover inline-block"
            >
              Upgrade plan
            </a>
          )}
          {hasBillingAccess(profile?.plan) && hasSubscription && (
            <button
              onClick={handleManageBilling}
              className="text-sm text-brand underline hover:text-foreground transition-colors"
            >
              Manage billing & subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

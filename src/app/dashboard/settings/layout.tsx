"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import { useAuth } from "@/context/AuthContext";
import {
  hasBillingAccess,
  canManageTeam,
  canAccessDataSettings,
} from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Tab definitions — planCheck is optional; if provided, tab is hidden when false
// ---------------------------------------------------------------------------

type SettingsTab = {
  label: string;
  href: string;
  planCheck?: (plan: string | null | undefined) => boolean;
};

const tabs: SettingsTab[] = [
  { label: "Account", href: "/dashboard/settings" },
  { label: "Billing", href: "/dashboard/settings/billing", planCheck: hasBillingAccess },
  { label: "Team", href: "/dashboard/settings/team", planCheck: canManageTeam },
  { label: "Security", href: "/dashboard/settings/security" },
  { label: "Integrations", href: "/dashboard/settings/integrations" },
  { label: "Data & Export", href: "/dashboard/settings/data", planCheck: canAccessDataSettings },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();

  // Mounted guard to avoid hydration mismatch on plan-gated tabs
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleTabs = mounted
    ? tabs.filter((t) => !t.planCheck || t.planCheck(profile?.plan))
    : tabs.filter((t) => !t.planCheck); // server: show only non-gated tabs

  return (
    <RequireAuth>
      <AuthenticatedShell>
        <div className="space-y-6">
          {/* Page header */}
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

          {/* Horizontal tab bar */}
          <nav className="border-b border-border flex gap-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const isActive =
                tab.href === "/dashboard/settings"
                  ? pathname === "/dashboard/settings"
                  : pathname.startsWith(tab.href);

              return (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={`
                    px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                    ${
                      isActive
                        ? "border-b-2 border-brand text-brand"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  {tab.label}
                </a>
              );
            })}
          </nav>

          {/* Tab content */}
          <div>{children}</div>
        </div>
      </AuthenticatedShell>
    </RequireAuth>
  );
}

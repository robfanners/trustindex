"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useVCCAuth } from "@/context/VCCAuthContext";
import { roleLabel } from "@/lib/vcc/permissions";
import type { VCCPermission } from "@/lib/vcc/permissions";

type VCCShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
  permission: VCCPermission;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/verisum-admin",
        icon: "chart",
        permission: "view_dashboard",
      },
      {
        label: "Risk Monitor",
        href: "/verisum-admin/risk-monitor",
        icon: "shield",
        permission: "view_aggregated_metrics",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Organisations",
        href: "/verisum-admin/organisations",
        icon: "building",
        permission: "view_org_details",
      },
      {
        label: "Surveys",
        href: "/verisum-admin/surveys",
        icon: "clipboard",
        permission: "view_org_details",
      },
      {
        label: "Systems",
        href: "/verisum-admin/systems",
        icon: "cpu",
        permission: "view_system_runs",
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        label: "Billing",
        href: "/verisum-admin/billing",
        icon: "credit",
        permission: "change_plans",
      },
      {
        label: "Audit Log",
        href: "/verisum-admin/audit-log",
        icon: "scroll",
        permission: "view_audit_log",
      },
      {
        label: "Settings",
        href: "/verisum-admin/settings",
        icon: "cog",
        permission: "manage_roles",
      },
    ],
  },
];

const SIDEBAR_KEY = "vcc_sidebar_collapsed";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function VCCNavIcon({ icon }: { icon: string }) {
  const cls = "w-5 h-5 shrink-0";
  switch (icon) {
    case "chart":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h2v8H3v-8zm6-5h2v13H9V8zm6-5h2v18h-2V3zm6 9h2v9h-2v-9z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "building":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-6 4h2m4 0h2" />
        </svg>
      );
    case "clipboard":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z" />
        </svg>
      );
    case "credit":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case "scroll":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "cog":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function VCCShell({ children }: VCCShellProps) {
  const pathname = usePathname();
  const { adminEmail, adminRoles, hasPermission, loading } = useVCCAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setSidebarCollapsed(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  // Filter nav sections by permission
  const filteredSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(item.permission)),
    })).filter((section) => section.items.length > 0);
  }, [hasPermission]);

  // Active nav detection
  const isActive = useCallback(
    (href: string) => {
      if (href === "/verisum-admin") return pathname === "/verisum-admin";
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const primaryRoleLabel = useMemo(() => {
    if (adminRoles.length === 0) return "";
    const priority = [
      "SUPER_ADMIN",
      "ORG_SUPPORT",
      "BILLING_ADMIN",
      "ANALYTICS_VIEWER",
    ] as const;
    for (const r of priority) {
      if (adminRoles.includes(r)) return roleLabel(r);
    }
    return roleLabel(adminRoles[0]);
  }, [adminRoles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading admin console…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 h-14 flex items-center px-4 sm:px-6">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          className="lg:hidden mr-3 p-1.5 text-gray-400 hover:text-gray-200"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Branding */}
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-100">
            Verisum
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-medium text-gray-300">
            Control Console
          </span>
        </div>

        {/* Right side: admin info */}
        <div className="ml-auto flex items-center gap-3">
          {primaryRoleLabel && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-brand/20 text-[#5ab0e8] font-medium">
              {primaryRoleLabel}
            </span>
          )}
          <span className="text-sm text-gray-400 hidden sm:inline">
            {adminEmail}
          </span>
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Exit VCC
          </a>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)]
            bg-gray-900 border-r border-gray-800
            flex flex-col
            transition-all duration-200 ease-in-out
            ${sidebarCollapsed ? "lg:w-14" : "lg:w-56"}
            w-56
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <nav className={`flex-1 py-4 overflow-y-auto ${sidebarCollapsed ? "lg:px-1.5" : "px-3"}`}>
            {filteredSections.map((section) => (
              <div key={section.title} className="mb-5">
                {!sidebarCollapsed && (
                  <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`
                          flex items-center gap-3 py-2 rounded-lg text-sm transition-colors
                          ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                          ${active
                            ? "bg-gray-800 text-[#5ab0e8] font-medium"
                            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
                          }
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <VCCNavIcon icon={item.icon} />
                        <span className={sidebarCollapsed ? "lg:hidden" : ""}>
                          {item.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:block border-t border-gray-800">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="w-full flex items-center justify-center py-3 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Sidebar footer */}
          <div className={`border-t border-gray-800 px-4 py-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <div className="text-xs text-gray-600">
              Verisum Control Console
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="p-6 lg:p-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

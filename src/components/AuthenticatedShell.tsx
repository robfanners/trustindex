"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import ModuleSwitcher from "@/components/header/ModuleSwitcher";
import GlobalSearch from "@/components/header/GlobalSearch";
import QuickCreate from "@/components/header/QuickCreate";
import NotificationBell from "@/components/header/NotificationBell";
import UserMenu from "@/components/header/UserMenu";
import HelpMenu from "@/components/header/HelpMenu";
import { navSections, meetsMinTier } from "@/lib/navigation";
import UpgradeModal from "@/components/UpgradeModal";
import type { VersiumTier } from "@/lib/tiers";
import { canSeeSection } from "@/lib/roles";

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

const SIDEBAR_KEY = "ti_sidebar_collapsed";


function NavIcon({ icon }: { icon: string }) {
  const cls = "w-5 h-5 shrink-0";
  switch (icon) {
    case "home":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
        </svg>
      );
    case "layout-dashboard":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="2" strokeWidth={1.5} />
          <rect x="14" y="3" width="7" height="7" rx="2" strokeWidth={1.5} />
          <rect x="3" y="14" width="7" height="7" rx="2" strokeWidth={1.5} />
          <rect x="14" y="14" width="7" height="7" rx="2" strokeWidth={1.5} />
        </svg>
      );
    case "clipboard":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "file-text":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "settings":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "scroll":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
        </svg>
      );
    case "activity":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
        </svg>
      );
    case "zap":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "user-check":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2m16 6l2 2 4-4M12.5 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "stamp":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 21h14M12 17V9m-3 8h6l1-4H8l1 4zM9 9a3 3 0 116 0" />
        </svg>
      );
    case "link":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      );
    case "search":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle strokeWidth={1.5} cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
        </svg>
      );
    case "lock":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      );
    case "building":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m5-10h.01M12 11h.01M9 15h.01M12 15h.01M9 7h.01M12 7h.01" />
        </svg>
      );
    case "server":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect strokeWidth={1.5} x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect strokeWidth={1.5} x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h.01M6 18h.01" />
        </svg>
      );
    case "radio":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
          <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
        </svg>
      );
    case "share":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle strokeWidth={1.5} cx="18" cy="5" r="3" />
          <circle strokeWidth={1.5} cx="6" cy="12" r="3" />
          <circle strokeWidth={1.5} cx="18" cy="19" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.59 13.51l6.83 3.98m-.01-10.98l-6.82 3.98" />
        </svg>
      );
    default:
      return null;
  }
}

function AuthenticatedShellInner({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalTier, setUpgradeModalTier] = useState<VersiumTier>("Assure");
  const [upgradeModalFeature, setUpgradeModalFeature] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setSidebarCollapsed(true);
      const navStored = localStorage.getItem("verisum_nav_expanded");
      if (navStored) setExpandedSections(JSON.parse(navStored));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const activeNav = useMemo(() => {
    // Exact matches first
    if (pathname.startsWith("/dashboard/settings")) return "/dashboard/settings";
    if (pathname === "/dashboard") return "/dashboard";
    // Section routes
    if (pathname.startsWith("/trustorg")) return "/trustorg";
    if (pathname.startsWith("/trustsys")) return "/trustsys";
    if (pathname.startsWith("/actions")) return "/actions";
    if (pathname.startsWith("/reports")) return "/reports";
    if (pathname.startsWith("/copilot")) return "/copilot/generate-policy";
    if (pathname.startsWith("/govern/models")) return "/govern/models";
    if (pathname.startsWith("/govern")) return pathname;
    if (pathname.startsWith("/monitor")) return pathname;
    if (pathname.startsWith("/prove")) return pathname;
    // Legacy routes
    if (pathname.startsWith("/dashboard/surveys")) return "/trustorg";
    if (pathname.startsWith("/systems")) return "/trustsys";
    return pathname;
  }, [pathname]);

  // Auto-expand the section containing the active nav item
  useEffect(() => {
    const activeSection = navSections.find((s) =>
      s.items.some((item) => activeNav === item.href)
    );
    if (activeSection?.label) {
      setExpandedSections((prev) => {
        if (prev[activeSection.id]) return prev; // already expanded
        const next = { ...prev, [activeSection.id]: true };
        try { localStorage.setItem("verisum_nav_expanded", JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [activeNav]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try { localStorage.setItem("verisum_nav_expanded", JSON.stringify(next)); } catch {}
      return next;
    });
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

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Top bar — glass morphism */}
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 backdrop-blur-lg bg-background/80 flex items-center px-4 sm:px-6">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          className="lg:hidden mr-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
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
        <Link
          href="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/verisum-icon.png"
            alt="Verisum"
            width={24}
            height={24}
            className="rounded-sm"
            style={{  }}
          />
          <span className="text-base font-bold text-brand">
            Verisum
          </span>
        </Link>

        {/* Module switcher */}
        <ModuleSwitcher />

        {/* Right side: header tools */}
        <div className="ml-auto flex items-center gap-1.5">
          <GlobalSearch />
          <QuickCreate />

          {/* AI placeholder */}
          <button
            type="button"
            disabled
            className="p-1.5 rounded-md text-muted-foreground cursor-not-allowed opacity-50"
            title="AI assistant — Coming soon"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </button>

          <NotificationBell />
          <HelpMenu />
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)]
            bg-card border-r border-border
            flex flex-col
            transition-all duration-200 ease-in-out
            ${sidebarCollapsed ? "lg:w-14" : "lg:w-56"}
            w-56
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <nav className={`flex-1 py-3 overflow-y-auto ${sidebarCollapsed ? "lg:px-1.5" : "px-3"}`}>
            {navSections.filter((section) => canSeeSection(profile?.role, section.id)).map((section) => {
              const isLocked = !meetsMinTier(profile?.plan, section.minTier);

              const isCollapsible = section.label && section.items.length > 1;
              const isExpanded = !isCollapsible || expandedSections[section.id] !== false;

              return (
                <div key={section.id} className={section.label ? "mt-5 first:mt-0" : ""}>
                  {/* Section header */}
                  {section.label && !sidebarCollapsed && (
                    isCollapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between px-3 mb-1 group"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            } ${isLocked ? "text-muted-foreground/40" : "text-muted-foreground/60 group-hover:text-muted-foreground"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className={`text-[10px] font-semibold tracking-widest ${
                            isLocked ? "text-muted-foreground/50" : "text-muted-foreground"
                          }`}>
                            {section.label}
                          </span>
                        </div>
                        {isLocked && section.tierBadge && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
                            {section.tierBadge}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between px-3 mb-1">
                        <span className={`text-[10px] font-semibold tracking-widest ${
                          isLocked ? "text-muted-foreground/50" : "text-muted-foreground"
                        }`}>
                          {section.label}
                        </span>
                      </div>
                    )
                  )}

                  {/* Collapsed section indicator */}
                  {section.label && sidebarCollapsed && (
                    <div className="hidden lg:flex justify-center my-2">
                      <div className={`w-5 h-px ${isLocked ? "bg-border/50" : "bg-border"}`} />
                    </div>
                  )}

                  {/* Nav items */}
                  <div
                    className={`space-y-0.5 transition-all duration-200 ease-in-out overflow-hidden ${
                      !sidebarCollapsed && isCollapsible && !isExpanded ? "max-h-0" : "max-h-[500px]"
                    }`}
                  >
                    {section.items.map((item) => {
                      const isActive = activeNav === item.href;
                      const href = isLocked ? "#" : item.href;

                      return (
                        <Link
                          key={item.href}
                          href={href}
                          title={sidebarCollapsed ? item.label : undefined}
                          onClick={(e) => {
                            if (isLocked) {
                              e.preventDefault();
                              setUpgradeModalTier((section.tierBadge as VersiumTier) ?? "Assure");
                              setUpgradeModalFeature(item.label);
                              setUpgradeModalOpen(true);
                              return;
                            }
                            setSidebarOpen(false);
                          }}
                          className={`
                            flex items-center gap-3 py-2 rounded-lg text-sm transition-all
                            ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                            ${isLocked
                              ? "text-muted-foreground/40 cursor-default"
                              : isActive
                                ? "bg-brand/10 text-brand font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }
                          `}
                        >
                          <NavIcon icon={item.icon} />
                          <span className={sidebarCollapsed ? "lg:hidden" : ""}>
                            {item.label}
                          </span>
                          {isLocked && !sidebarCollapsed && (
                            <NavIcon icon="lock" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:block border-t border-border">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
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
          <div className={`border-t border-border px-4 py-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <div className="text-xs text-muted-foreground">
              &copy; {currentYear} Verisum Ltd.
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="p-6 lg:p-8 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
      <UpgradeModal
        open={upgradeModalOpen}
        requiredTier={upgradeModalTier}
        featureLabel={upgradeModalFeature}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
}

export default function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  return <AuthenticatedShellInner>{children}</AuthenticatedShellInner>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import {
  Home,
  LayoutDashboard,
  ClipboardCheck,
  Cpu,
  CheckCircle2,
  FileText,
  Settings as SettingsIcon,
  ScrollText,
  HeartPulse,
  AlertTriangle,
  Zap,
  UserCheck,
  ShieldCheck,
  Stamp,
  Link2,
  Search,
  Lock,
  Building2,
  Server,
  Radio,
  Share2,
  GitBranch,
  KeyRound,
  Gavel,
} from "lucide-react";

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

const SIDEBAR_KEY = "ti_sidebar_collapsed";


/**
 * Canonical icon registry — one Lucide icon per capability, used everywhere.
 * To lock a new capability icon: add a case here + reference by key from navigation.ts.
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "home": Home,
  "layout-dashboard": LayoutDashboard,
  "clipboard": ClipboardCheck,
  "cpu": Cpu,
  "check-circle": CheckCircle2,
  "file-text": FileText,
  "settings": SettingsIcon,
  "scroll": ScrollText,
  "activity": HeartPulse,       // Drift & Alerts — heartbeat
  "alert-triangle": AlertTriangle, // Escalations
  "zap": Zap,                   // Incidents — lightning
  "user-check": UserCheck,      // Declarations
  "shield-check": ShieldCheck,  // Approvals
  "stamp": Stamp,               // Attestations
  "link": Link2,                // Provenance
  "search": Search,             // Verification
  "lock": Lock,                 // Incident Lock
  "building": Building2,        // Vendors
  "server": Server,             // AI Registry
  "radio": Radio,               // Signals
  "share": Share2,              // Trust Exchange
  "git-branch": GitBranch,      // TrustGraph
  "key": KeyRound,              // API Keys
  "gavel": Gavel,               // Regulation & Compliance
};

function NavIcon({ icon }: { icon: string }) {
  const Comp = ICON_MAP[icon];
  if (!Comp) return null;
  return <Comp className="w-5 h-5 shrink-0" strokeWidth={1.75} />;
}

function AuthenticatedShellInner({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
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
      if (stored === "true") setSidebarCollapsed(true); // eslint-disable-line react-hooks/set-state-in-effect
      const navStored = localStorage.getItem("verisum_nav_expanded");
      if (navStored) setExpandedSections(JSON.parse(navStored));  
    } catch {
      // localStorage unavailable
    }
  }, [setSidebarCollapsed, setExpandedSections]);

  const activeNav = useMemo(() => {
    // Exact matches first
    if (pathname.startsWith("/dashboard/settings")) return "/dashboard/settings";
    if (pathname === "/dashboard") return "/dashboard";
    // Section routes
    if (pathname.startsWith("/trustorg")) return "/govern/trustgraph";
    if (pathname.startsWith("/trustsys")) return "/govern/trustgraph";
    if (pathname.startsWith("/actions")) return "/actions";
    if (pathname.startsWith("/reports")) return "/reports";
    if (pathname.startsWith("/copilot")) return "/copilot/generate-policy";
    if (pathname.startsWith("/govern/trustgraph")) return "/govern/trustgraph";
    if (pathname.startsWith("/govern/models")) return "/govern/models";
    if (pathname.startsWith("/govern")) return pathname;
    if (pathname.startsWith("/monitor")) return pathname;
    if (pathname.startsWith("/prove")) return pathname;
    // Legacy routes
    if (pathname.startsWith("/dashboard/surveys")) return "/govern/trustgraph";
    if (pathname.startsWith("/systems")) return "/govern/trustgraph";
    return pathname;
  }, [pathname]);

  // Auto-expand the section containing the active nav item
  useEffect(() => {
    const activeSection = navSections.find((s) =>
      s.items.some((item) => activeNav === item.href)
    );
    if (activeSection?.label) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
                      <div className="w-full flex items-center justify-between px-3 mb-1 group">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Arrow-only toggle: expands/collapses sub-nav */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection(section.id);
                            }}
                            aria-label={isExpanded ? `Collapse ${section.label}` : `Expand ${section.label}`}
                            className="p-0.5 -m-0.5 rounded hover:bg-brand/10 transition-colors cursor-pointer"
                          >
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
                          </button>
                          {/* Label navigates to section page (does NOT toggle expand) */}
                          {section.href && !isLocked ? (
                            <Link
                              href={section.href}
                              className={`text-[10px] font-semibold tracking-widest truncate transition-colors ${
                                activeNav === section.href
                                  ? "text-brand"
                                  : "text-muted-foreground hover:text-foreground cursor-pointer"
                              }`}
                            >
                              {section.label}
                            </Link>
                          ) : (
                            <span className={`text-[10px] font-semibold tracking-widest truncate ${
                              isLocked ? "text-muted-foreground/50" : "text-muted-foreground"
                            }`}>
                              {section.label}
                            </span>
                          )}
                        </div>
                        {isLocked && section.tierBadge && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
                            {section.tierBadge}
                          </span>
                        )}
                      </div>
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
          <div className="p-6 lg:p-8 max-w-[1600px]">
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

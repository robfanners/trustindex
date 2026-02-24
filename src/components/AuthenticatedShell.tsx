"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

const SIDEBAR_KEY = "ti_sidebar_collapsed";

const navLinks = [
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Create Survey", href: "/dashboard/surveys/new", icon: "plus" },
  { label: "My Surveys", href: "/dashboard#surveys", icon: "list" },
  { label: "Systems", href: "/dashboard?tab=systems", icon: "cpu" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "home":
      return (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
        </svg>
      );
    case "plus":
      return (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      );
    case "list":
      return (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    case "cpu":
      return (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z" />
        </svg>
      );
    case "settings":
      return (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

function AuthenticatedShellInner({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const currentYear = new Date().getFullYear();

  const activeNav = useMemo(() => {
    if (pathname.startsWith("/dashboard/settings")) return "/dashboard/settings";
    if (pathname === "/dashboard") {
      const tab = searchParams.get("tab");
      if (tab === "systems") return "/dashboard?tab=systems";
      return "/dashboard";
    }
    if (pathname.startsWith("/dashboard/surveys/new")) return "/dashboard/surveys/new";
    return pathname;
  }, [pathname, searchParams]);

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Top bar — glass morphism */}
      <header className="sticky top-0 z-50 h-14 border-b border-border backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/80 flex items-center px-4 sm:px-6">
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
        <a
          href="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/verisum-icon.png"
            alt="TrustGraph"
            width={24}
            height={24}
            className="rounded-sm"
            style={{ filter: "hue-rotate(-30deg) saturate(0.8)" }}
          />
          <span className="text-base font-bold text-brand">
            TrustGraph
          </span>
        </a>

        {/* Right side: user info */}
        <div className="ml-auto flex items-center gap-3">
          {profile && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-brand-subtle text-brand font-medium capitalize">
              {profile.plan}
            </span>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log out
          </button>
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
          <nav className={`flex-1 py-4 space-y-1 ${sidebarCollapsed ? "lg:px-1.5" : "px-3"}`}>
            {navLinks.map((link) => {
              const isActive = activeNav === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  title={sidebarCollapsed ? link.label : undefined}
                  className={`
                    flex items-center gap-3 py-2 rounded-lg text-sm transition-all
                    ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                    ${isActive
                      ? "bg-brand/10 text-brand font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <NavIcon icon={link.icon} />
                  <span className={sidebarCollapsed ? "lg:hidden" : ""}>
                    {link.label}
                  </span>
                </a>
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
              &copy; {currentYear} Verisum &middot; TrustGraph&trade;
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
    </div>
  );
}

export default function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  return (
    <Suspense>
      <AuthenticatedShellInner>{children}</AuthenticatedShellInner>
    </Suspense>
  );
}

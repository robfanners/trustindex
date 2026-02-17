"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

const SIDEBAR_KEY = "ti_sidebar_collapsed";

const navLinks = [
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Create Survey", href: "/admin/new-run", icon: "plus" },
  { label: "My Surveys", href: "/dashboard#surveys", icon: "list" },
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
    default:
      return null;
  }
}

export default function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Hydrate collapsed state from localStorage (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setSidebarCollapsed(true);
    } catch {
      // localStorage unavailable — stay expanded
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
    if (pathname === "/dashboard") return "/dashboard";
    if (pathname.startsWith("/admin/new-run")) return "/admin/new-run";
    return pathname;
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-verisum-white border-b border-verisum-grey h-14 flex items-center px-4 sm:px-6">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          className="lg:hidden mr-3 p-1.5 text-verisum-grey hover:text-verisum-black"
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
          <a
            href="https://www.verisum.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
          >
            Verisum
          </a>
          <span className="text-verisum-grey">|</span>
          <a
            href="/dashboard"
            className="text-base font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
          >
            TrustIndex™
          </a>
        </div>

        {/* Right side: user info */}
        <div className="ml-auto flex items-center gap-3">
          {profile && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-verisum-blue/10 text-verisum-blue font-medium capitalize">
              {profile.plan}
            </span>
          )}
          <span className="text-sm text-verisum-grey hidden sm:inline">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-sm text-verisum-grey hover:text-verisum-black transition-colors"
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
            bg-verisum-white border-r border-verisum-grey
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
                    flex items-center gap-3 py-2 rounded-lg text-sm transition-colors
                    ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                    ${isActive
                      ? "bg-verisum-blue/10 text-verisum-blue font-medium"
                      : "text-verisum-grey hover:text-verisum-black hover:bg-gray-100"
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
          <div className="hidden lg:block border-t border-verisum-grey">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="w-full flex items-center justify-center py-3 text-verisum-grey hover:text-verisum-black transition-colors"
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
          <div className={`border-t border-verisum-grey px-4 py-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <div className="text-xs text-verisum-grey">
              &copy; {currentYear} Verisum
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

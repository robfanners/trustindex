"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();

  const currentYear = new Date().getFullYear();

  // Extract runId from pathname if on /admin/run/[runId] or /dashboard/[runId]
  const adminRunMatch = pathname.match(/^\/admin\/run\/([^/]+)/);
  const dashboardRunMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const runId = adminRunMatch?.[1] ?? dashboardRunMatch?.[1] ?? null;

  const isAdminOrDashboard = pathname.startsWith("/admin") || pathname.startsWith("/dashboard");

  const navItems = useMemo(() => {
    const items: Array<{ label: string; href: string; isActive?: boolean; isExternal?: boolean }> = [
      { label: "Create survey", href: "/admin/new-run" },
    ];

    // Survey Dashboard and Results: show on admin and dashboard pages. Link to run when we have runId, else to resume flow.
    if (isAdminOrDashboard) {
      items.push(
        {
          label: "Survey Dashboard",
          href: runId ? `/admin/run/${runId}` : "/?resume=admin",
          isActive: runId ? pathname === `/admin/run/${runId}` : false,
        },
        {
          label: "Results",
          href: runId ? `/dashboard/${runId}` : "/?resume=admin",
          isActive: runId ? pathname === `/dashboard/${runId}` : false,
        }
      );
    }

    if (pathname === "/verisum") {
      items.push({ label: "Verisum Admin", href: "/verisum", isActive: true });
    }

    return items;
  }, [pathname, runId, isAdminOrDashboard]);

  return (
    <div className="min-h-screen bg-verisum-white text-verisum-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-verisum-white border-b border-verisum-grey backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                TrustGraph™
              </a>
            </div>

            {/* Right: Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map((item) => (
                <a
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noopener noreferrer" : undefined}
                  className={`text-sm px-3 py-2 rounded transition-colors ${
                    item.isActive
                      ? "text-verisum-blue font-medium"
                      : "text-verisum-grey hover:text-verisum-black"
                  }`}
                >
                  {item.label}
                </a>
              ))}
              {!authLoading && (
                user ? (
                  <div className="flex items-center gap-3 ml-2 pl-2 border-l border-verisum-grey">
                    <a
                      href="/dashboard"
                      className="text-sm text-verisum-grey hover:text-verisum-black transition-colors"
                    >
                      {user.email}
                    </a>
                    <button
                      onClick={signOut}
                      className="text-sm text-verisum-grey hover:text-verisum-black transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                ) : (
                  <a
                    href="/auth/login"
                    className="text-sm px-3 py-2 rounded transition-colors text-verisum-blue hover:text-verisum-black font-medium ml-2"
                  >
                    Log in
                  </a>
                )
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 text-verisum-grey hover:text-verisum-black"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-verisum-grey">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <a
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    target={item.isExternal ? "_blank" : undefined}
                    rel={item.isExternal ? "noopener noreferrer" : undefined}
                    className={`text-sm px-3 py-2 rounded transition-colors ${
                      item.isActive
                        ? "text-verisum-blue font-medium bg-verisum-white"
                        : "text-verisum-grey hover:text-verisum-black hover:bg-verisum-white"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                {!authLoading && (
                  user ? (
                    <>
                      <div className="border-t border-verisum-grey mt-2 pt-2">
                        <a
                          href="/dashboard"
                          className="text-sm px-3 py-2 rounded text-verisum-grey hover:text-verisum-black block"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {user.email}
                        </a>
                        <button
                          onClick={() => { signOut(); setMobileMenuOpen(false); }}
                          className="text-sm px-3 py-2 rounded text-verisum-grey hover:text-verisum-black w-full text-left"
                        >
                          Log out
                        </button>
                      </div>
                    </>
                  ) : (
                    <a
                      href="/auth/login"
                      className="text-sm px-3 py-2 rounded text-verisum-blue font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </a>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-verisum-grey bg-verisum-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-verisum-grey">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span>© {currentYear} Verisum • TrustGraph™</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-xs">Built in the UK</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://www.verisum.org/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-verisum-black transition-colors"
              >
                Privacy
              </a>
              <a
                href="https://www.verisum.org/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-verisum-black transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

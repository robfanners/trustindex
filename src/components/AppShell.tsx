"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentYear = new Date().getFullYear();

  // Extract runId from pathname if on /admin/run/[runId]
  const runIdMatch = pathname.match(/^\/admin\/run\/([^/]+)/);
  const runId = runIdMatch ? runIdMatch[1] : null;

  const navItems = useMemo(() => {
    const items: Array<{ label: string; href: string; isActive?: boolean; isExternal?: boolean }> = [
      { label: "Create survey", href: "/admin/new-run" },
    ];

    if (runId) {
      items.push(
        { label: "Survey Dashboard", href: `/admin/run/${runId}`, isActive: pathname === `/admin/run/${runId}` },
        { label: "Results", href: `/dashboard/${runId}` }
      );
    }

    if (pathname === "/verisum") {
      items.push({ label: "Verisum Admin", href: "/verisum", isActive: true });
    }

    return items;
  }, [pathname, runId]);

  return (
    <div className="min-h-screen bg-verisum-white text-verisum-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-verisum-white border-b border-verisum-grey backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.verisum.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                Verisum
              </a>
              <span className="text-verisum-grey">|</span>
              <a
                href="/"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                TrustIndex™
              </a>
            </div>

            {/* Right: Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map((item) => (
                <a
                  key={item.href}
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
                    key={item.href}
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
              <span>© {currentYear} Verisum • TrustIndex™</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-xs">Built in the UK</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-verisum-black transition-colors opacity-50 cursor-not-allowed">
                Privacy
              </a>
              <a href="#" className="hover:text-verisum-black transition-colors opacity-50 cursor-not-allowed">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

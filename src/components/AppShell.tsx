"use client";

import Image from "next/image";
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header — glass morphism */}
      <header className="sticky top-0 z-50 h-16 border-b border-border/60 backdrop-blur-lg bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Logo + Brand */}
            <a
              href="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/verisum-icon.png"
                alt="TrustGraph"
                width={28}
                height={28}
                className="rounded-sm"
                style={{  }}
              />
              <span className="text-base font-bold text-brand">
                TrustGraph
              </span>
            </a>

            {/* Right: Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noopener noreferrer" : undefined}
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-all ${
                    item.isActive
                      ? "text-brand bg-brand-subtle"
                      : "text-muted-foreground hover:text-foreground hover:bg-brand-subtle"
                  }`}
                >
                  {item.label}
                </a>
              ))}

              {!authLoading && (
                user ? (
                  <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
                    <a
                      href="/dashboard"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {user.email}
                    </a>
                    <button
                      onClick={signOut}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                ) : (
                  <a
                    href="/auth/login"
                    className="ml-3 text-sm font-semibold px-5 py-2 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-brand/30 transition-all duration-300"
                  >
                    Log in
                  </a>
                )
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <a
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    target={item.isExternal ? "_blank" : undefined}
                    rel={item.isExternal ? "noopener noreferrer" : undefined}
                    className={`text-sm font-medium px-3 py-2 rounded-md transition-all ${
                      item.isActive
                        ? "text-brand bg-brand-subtle"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                {!authLoading && (
                  user ? (
                    <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
                      <a
                        href="/dashboard"
                        className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {user.email}
                      </a>
                      <button
                        onClick={() => { signOut(); setMobileMenuOpen(false); }}
                        className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted w-full text-left transition-all"
                      >
                        Log out
                      </button>
                    </div>
                  ) : (
                    <a
                      href="/auth/login"
                      className="text-sm font-semibold px-5 py-2 mt-2 rounded-full bg-brand text-brand-foreground text-center shadow-lg shadow-brand/20 hover:bg-brand-hover transition-all duration-300"
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

      {/* Footer — dark navy gradient */}
      <footer
        className="text-white"
        style={{ background: "linear-gradient(180deg, #0a2540 0%, #061b2e 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand column */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <Image
                  src="/verisum-icon-white.png"
                  alt="Verisum"
                  width={24}
                  height={24}
                  className="rounded-sm opacity-90"
                />
                <span className="text-sm font-bold text-white">
                  TrustGraph
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                Measure, map and strengthen trust.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3">
                Product
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="/try" className="text-sm text-white/50 hover:text-white transition-colors">
                    Try Explorer
                  </a>
                </li>
                <li>
                  <a href="/upgrade" className="text-sm text-white/50 hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3">
                Company
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://www.verisum.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    Verisum Ltd.
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3">
                Legal
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://www.verisum.org/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.verisum.org/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-white/40">
              © {currentYear} Verisum Ltd. • TrustGraph™ • Built in the UK
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const modules = [
  { label: "TrustOrg Surveys", href: "/trustorg" },
  { label: "TrustSys Assessments", href: "/trustsys" },
  { label: "Actions", href: "/actions" },
  { label: "Reports", href: "/reports" },
];

export default function ModuleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = modules.find(
    (m) => pathname.startsWith(m.href) || (m.href === "/trustorg" && pathname.startsWith("/dashboard/surveys"))
  );

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        {current?.label ?? "Modules"}
        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-52 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          {modules.map((m) => {
            const active = pathname.startsWith(m.href);
            return (
              <button
                key={m.href}
                onClick={() => { router.push(m.href); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  active ? "bg-brand/10 text-brand font-medium" : "text-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

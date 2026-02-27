"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const actions = [
  { label: "New TrustOrg Survey", href: "/dashboard/surveys/new" },
  { label: "New TrustSys Assessment", href: "/trustsys/new" },
  { label: "New Action", href: "/actions/new" },
];

export default function QuickCreate() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Quick create"
        title="Create new..."
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          {actions.map((a) => (
            <button
              key={a.href}
              onClick={() => { router.push(a.href); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

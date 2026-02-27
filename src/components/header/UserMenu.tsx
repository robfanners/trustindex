"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function UserMenu() {
  const { user, profile, signOut } = useAuth();
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

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-brand/10 text-brand text-xs font-semibold flex items-center justify-center hover:bg-brand/20 transition-colors"
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm text-foreground truncate">{user?.email}</div>
            {profile?.plan && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-brand-subtle text-brand font-medium capitalize">
                {profile.plan}
              </span>
            )}
          </div>
          <button
            onClick={() => { router.push("/dashboard/settings"); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => { signOut(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

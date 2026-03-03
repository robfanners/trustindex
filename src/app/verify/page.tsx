"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

export default function VerifyLandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/verify/${trimmed}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-20">
        {/* Centered content */}
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Shield icon */}
          <div className="p-3 rounded-2xl bg-brand/10 text-brand">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold">
            Verify a Governance Record
          </h1>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            Enter a verification ID to independently confirm the authenticity
            and integrity of a Verisum governance record.
          </p>

          {/* Search input + button */}
          <div className="w-full flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="VER-A1B2C3D4"
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-base font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!query.trim()}
              className="px-6 py-3 rounded-lg bg-brand text-white font-medium hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Verify
            </button>
          </div>
        </div>

        {/* Explainer section */}
        <div className="mt-16 border-t border-border pt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            What is a verification ID?
          </h2>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">
            Every attestation and provenance certificate issued through Verisum
            receives a unique verification ID. Share this ID with auditors,
            regulators, or partners to let them independently verify the record.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

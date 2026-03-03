"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TIERS, type VersiumTier } from "@/lib/tiers";

type UpgradeModalProps = {
  open: boolean;
  requiredTier: VersiumTier;
  featureLabel?: string;
  onClose: () => void;
};

export default function UpgradeModal({ open, requiredTier, featureLabel, onClose }: UpgradeModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const tier = TIERS[requiredTier];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-background rounded-xl shadow-xl w-full max-w-md mx-4 p-6 border border-border"
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Lock icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-brand/10">
            <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </div>

        {/* Tier badge */}
        <div className="text-center mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand/10 text-brand">
            Verisum {tier.name}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-center mb-1">
          {featureLabel
            ? `${featureLabel} requires ${tier.name}`
            : `Upgrade to ${tier.name}`}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-5">
          {tier.tagline}
        </p>

        {/* Feature highlights */}
        <ul className="space-y-2 mb-6">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm">
              {h.endsWith(":") ? (
                <span className="text-muted-foreground font-medium">{h}</span>
              ) : (
                <>
                  <svg className="w-4 h-4 text-brand shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground">{h}</span>
                </>
              )}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Link
            href="/upgrade"
            onClick={onClose}
            className="w-full text-center px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            View Plans & Pricing
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

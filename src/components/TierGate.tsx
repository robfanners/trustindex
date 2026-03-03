"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasTierAccess, type VersiumTier } from "@/lib/tiers";
import UpgradeModal from "@/components/UpgradeModal";

type TierGateProps = {
  requiredTier: VersiumTier;
  featureLabel: string;
  children: React.ReactNode;
  /** Optional: render a custom locked preview instead of the default */
  lockedPreview?: React.ReactNode;
};

export default function TierGate({ requiredTier, featureLabel, children, lockedPreview }: TierGateProps) {
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (hasTierAccess(profile?.plan, requiredTier)) {
    return <>{children}</>;
  }

  return (
    <>
      {lockedPreview ?? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full border border-dashed border-border rounded-xl p-8 text-center space-y-3 hover:border-brand/30 hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <div className="text-muted-foreground/60">
            <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <p className="text-sm font-medium">{featureLabel}</p>
            <p className="text-xs mt-1">
              Available on Verisum {requiredTier} —{" "}
              <span className="text-brand underline">learn more</span>
            </p>
          </div>
        </button>
      )}
      <UpgradeModal
        open={showModal}
        requiredTier={requiredTier}
        featureLabel={featureLabel}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

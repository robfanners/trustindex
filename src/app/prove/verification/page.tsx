import TierPlaceholder from "@/components/TierPlaceholder";

export default function VerificationPage() {
  return (
    <TierPlaceholder
      title="Verification Portal"
      description="Validate governance proofs, verify attestation signatures, and confirm on-chain anchoring. Share verification links with external parties for independent trust validation."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle strokeWidth={1.5} cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
        </svg>
      }
    />
  );
}

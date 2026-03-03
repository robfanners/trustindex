import TierPlaceholder from "@/components/TierPlaceholder";

export default function ProvenancePage() {
  return (
    <TierPlaceholder
      title="Provenance Certificates"
      description="Generate verifiable chain-of-custody records for AI outputs. Bind model version, prompt classification, data sources, and human reviewer into a cryptographic proof of origin."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      }
    />
  );
}

import TierPlaceholder from "@/components/TierPlaceholder";

export default function ApprovalsPage() {
  return (
    <TierPlaceholder
      title="Approval Inbox"
      description="Review and cryptographically sign high-risk AI actions. Each approval is bound to your verified identity, the system state, and risk classification — creating tamper-resistant proof of human oversight."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
        </svg>
      }
    />
  );
}

"use client";

// ---------------------------------------------------------------------------
// /dashboard/settings/integrations — Connectors (Coming Soon)
// ---------------------------------------------------------------------------

const integrations = [
  {
    name: "Slack",
    description: "Get trust score alerts and survey notifications in Slack.",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <path d="M14.5 2a2 2 0 00-2 2v4h4a2 2 0 000-4h-2zm0 0" fill="#E01E5A" />
        <path d="M2 9.5a2 2 0 002 2h4v-4a2 2 0 00-4 0v2zm0 0" fill="#36C5F0" />
        <path d="M9.5 22a2 2 0 002-2v-4h-4a2 2 0 000 4h2zm0 0" fill="#2EB67D" />
        <path d="M22 14.5a2 2 0 00-2-2h-4v4a2 2 0 004 0v-2zm0 0" fill="#ECB22E" />
        <path d="M8.5 9.5h7v5h-7z" fill="#ECB22E" opacity=".2" />
      </svg>
    ),
    action: "Connect",
  },
  {
    name: "Microsoft Teams",
    description: "Share trust reports and survey links directly in Teams channels.",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#5B5FC7" opacity="0.15" />
        <path d="M8 8h8v8H8z" fill="#5B5FC7" opacity="0.3" />
        <text x="12" y="16" textAnchor="middle" fill="#5B5FC7" fontSize="10" fontWeight="bold">T</text>
      </svg>
    ),
    action: "Connect",
  },
  {
    name: "Jira",
    description: "Create and track trust improvement actions as Jira tickets.",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 12l10 10 10-10L12 2z" fill="#2684FF" opacity="0.15" />
        <path d="M12 7l-5 5 5 5 5-5-5-5z" fill="#2684FF" opacity="0.3" />
        <path d="M12 10l-2 2 2 2 2-2-2-2z" fill="#2684FF" />
      </svg>
    ),
    action: "Connect",
  },
  {
    name: "GRC Export",
    description: "Export trust data in formats compatible with GRC platforms.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="text-verisum-grey" />
      </svg>
    ),
    action: "Configure",
  },
];

export default function IntegrationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="border border-verisum-grey rounded-lg p-6 space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-verisum-black">
            Connectors
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-verisum-grey font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-verisum-grey">
          Connect TrustGraph with your existing tools and workflows.
          Integrations are coming in a future release.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {integrations.map((int) => (
          <div
            key={int.name}
            className="border border-verisum-grey rounded-lg p-5 space-y-3 opacity-60"
          >
            <div className="flex items-center gap-3">
              {int.icon}
              <div>
                <h3 className="text-sm font-semibold text-verisum-black">
                  {int.name}
                </h3>
              </div>
            </div>
            <p className="text-xs text-verisum-grey">{int.description}</p>
            <button
              disabled
              className="px-3 py-1.5 rounded border border-verisum-grey text-xs text-verisum-grey cursor-not-allowed"
            >
              {int.action}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-verisum-grey text-center">
        Integrations are coming in a future release. Contact{" "}
        <a
          href="mailto:hello@verisum.org"
          className="text-verisum-blue underline hover:text-verisum-black"
        >
          hello@verisum.org
        </a>{" "}
        to request early access.
      </p>
    </div>
  );
}

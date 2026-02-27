"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// /dashboard/settings/integrations — Categorised Integrations
// ---------------------------------------------------------------------------

type IntegrationCard = {
  name: string;
  description: string;
  active: boolean;
  connectHref?: string;
};

type Category = {
  title: string;
  cards: IntegrationCard[];
};

const categories: Category[] = [
  {
    title: "People & Talent",
    cards: [
      { name: "HiBob", description: "Sync org structure (divisions, departments, teams) from HiBob.", active: true, connectHref: "/api/integrations/hibob/auth" },
      { name: "Deel", description: "Import team structure and employee data from Deel.", active: false },
      { name: "Workday", description: "Sync workforce data from Workday HCM.", active: false },
      { name: "ADP", description: "Import organisational hierarchy from ADP.", active: false },
      { name: "Rippling", description: "Sync employee and department data from Rippling.", active: false },
      { name: "Personio", description: "Import team structure from Personio HR.", active: false },
    ],
  },
  {
    title: "Communication & Collaboration",
    cards: [
      { name: "Slack", description: "Get trust score alerts and survey notifications in Slack.", active: false },
      { name: "Microsoft Teams", description: "Share trust reports and survey links in Teams channels.", active: false },
    ],
  },
  {
    title: "Project & Delivery",
    cards: [
      { name: "Jira", description: "Create and track trust improvement actions as Jira tickets.", active: false },
    ],
  },
  {
    title: "Governance, Risk & Compliance",
    cards: [
      { name: "GRC Export", description: "Export trust data in formats compatible with GRC platforms.", active: false },
    ],
  },
];

export default function IntegrationsSettingsPage() {
  const [hibobStatus, setHibobStatus] = useState<string | null>(null);
  const [hibobLastSync, setHibobLastSync] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/hibob/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setHibobStatus(data.status ?? null);
          setHibobLastSync(data.last_synced_at ?? null);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect TrustGraph with your existing tools and workflows.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {cat.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.cards.map((card) => (
              <div
                key={card.name}
                className={`border border-border rounded-lg p-5 space-y-3 ${
                  card.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">{card.name}</h4>
                  {!card.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium dark:bg-gray-800">
                      Coming Soon
                    </span>
                  )}
                  {card.name === "HiBob" && hibobStatus === "connected" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium dark:bg-green-900 dark:text-green-300">
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{card.description}</p>

                {/* HiBob-specific: show last synced */}
                {card.name === "HiBob" && hibobStatus === "connected" && hibobLastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(hibobLastSync).toLocaleDateString()}
                  </p>
                )}

                {card.active ? (
                  <a
                    href={card.connectHref ?? "#"}
                    className="inline-block px-3 py-1.5 rounded bg-brand text-white text-xs font-medium hover:bg-brand-hover"
                  >
                    {card.name === "HiBob" && hibobStatus === "connected" ? "Manage" : "Connect"}
                  </a>
                ) : (
                  <button
                    disabled
                    className="px-3 py-1.5 rounded border border-border text-xs text-muted-foreground cursor-not-allowed"
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground text-center">
        More integrations are coming soon. Contact{" "}
        <a
          href="mailto:hello@verisum.org"
          className="text-brand underline hover:text-foreground"
        >
          hello@verisum.org
        </a>{" "}
        to request early access.
      </p>
    </div>
  );
}

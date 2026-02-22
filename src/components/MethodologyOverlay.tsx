"use client";

import { useState } from "react";

type Props = {
  module?: "org" | "sys";
};

export default function MethodologyOverlay({ module = "org" }: Props) {
  const [open, setOpen] = useState(false);

  const dimensions =
    module === "org"
      ? [
          {
            name: "Transparency",
            weight: "20%",
            description:
              "Visibility and clarity of decision-making processes.",
          },
          {
            name: "Inclusion",
            weight: "20%",
            description:
              "Psychological safety and participation across the organisation.",
          },
          {
            name: "Confidence",
            weight: "20%",
            description:
              "Trust in leadership follow-through and consistency.",
          },
          {
            name: "Explainability",
            weight: "20%",
            description:
              "How well decisions (especially AI-supported) can be understood.",
          },
          {
            name: "Risk",
            weight: "20%",
            description:
              "Strength of governance controls and escalation paths.",
          },
        ]
      : [
          {
            name: "Transparency",
            weight: "20%",
            description:
              "Clarity of system purpose, limitations, and outputs.",
          },
          {
            name: "Inclusion",
            weight: "20%",
            description:
              "Stakeholder involvement in system oversight.",
          },
          {
            name: "Confidence",
            weight: "20%",
            description:
              "Trust in system reliability and consistency.",
          },
          {
            name: "Explainability",
            weight: "20%",
            description:
              "How well system decisions can be explained to humans.",
          },
          {
            name: "Risk",
            weight: "20%",
            description:
              "Controls for identifying, escalating, and mitigating system risk.",
          },
        ];

  return (
    <>
      {/* Info icon trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        aria-label="View methodology"
        title="View methodology"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Content */}
          <div className="relative bg-card rounded-xl shadow-lg border border-border max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                TrustGraph Methodology
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Evidence scoring */}
            <div>
              <h3 className="text-sm font-medium mb-1">Evidence Scoring</h3>
              <p className="text-xs text-muted-foreground">
                Responses are collected on a Likert scale (1&ndash;5) and
                normalised to 0&ndash;100 for dimension and overall scores.
              </p>
            </div>

            {/* Dimensions */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                Dimensions &amp; Weighting
              </h3>
              <div className="space-y-2">
                {dimensions.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-start gap-3 text-xs"
                  >
                    <span className="font-medium w-28 shrink-0">
                      {d.name}
                    </span>
                    <span className="text-muted-foreground/70 w-10 shrink-0">
                      {d.weight}
                    </span>
                    <span className="text-muted-foreground">
                      {d.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Version */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
              <span>
                Methodology version:{" "}
                <strong>TrustGraph v1.0</strong>
              </span>
              <span>
                Last updated: <strong>February 2026</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

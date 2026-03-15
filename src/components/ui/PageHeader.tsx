"use client";

import Link from "next/link";

type WorkflowStep = { label: string; href: string };

type PageHeaderProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  workflowHint?: WorkflowStep[];
  actions?: React.ReactNode;
  automationStatus?: React.ReactNode;
};

export default function PageHeader({
  icon,
  title,
  description,
  workflowHint,
  actions,
  automationStatus,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">{icon}</div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {automationStatus}
          {actions}
        </div>
      </div>

      {/* Workflow hint */}
      {workflowHint && workflowHint.length > 0 && (
        <div data-tour="workflow-hint" className="flex items-center gap-1 text-xs text-muted-foreground pl-12">
          {workflowHint.map((step, i) => (
            <span key={step.href} className="flex items-center gap-1">
              {i > 0 && <span className="mx-1">&rarr;</span>}
              <Link
                href={step.href}
                className="hover:text-foreground transition-colors"
              >
                {step.label}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

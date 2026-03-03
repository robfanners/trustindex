"use client";

import Link from "next/link";

type TierPlaceholderProps = {
  title: string;
  description: string;
  tierName: string;
  icon: React.ReactNode;
};

export default function TierPlaceholder({ title, description, tierName, icon }: TierPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
            {tierName}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground max-w-xl">{description}</p>
      <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-4">
        <div className="text-muted-foreground/60">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="text-sm font-medium">Available on Verisum {tierName}</p>
          <p className="text-xs mt-1">Upgrade your plan to unlock this capability</p>
        </div>
        <Link
          href="/upgrade"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
}

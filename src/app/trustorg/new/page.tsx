"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /trustorg/new redirects to the existing survey creation flow.
 * This will be replaced with a native TrustOrg survey creation page in Phase 2.
 */
export default function TrustOrgNewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/surveys/new");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Redirecting...
      </div>
    </div>
  );
}

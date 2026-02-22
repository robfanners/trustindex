"use client";

import { useEffect } from "react";
import { useVCCAuth } from "@/context/VCCAuthContext";

/**
 * Client-side guard — redirects non-admin users to /dashboard.
 * Wraps children and renders nothing while loading / if unauthorised.
 */
export default function RequireAdminRole({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading } = useVCCAuth();

  useEffect(() => {
    if (!loading && !isAdmin) {
      window.location.href = "/dashboard";
    }
  }, [loading, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-sm">Verifying admin access…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}

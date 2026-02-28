"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /trustsys/new — redirects to /trustsys with showForm flag.
 * The TrustSys list page handles creation inline.
 */
export default function TrustSysNewRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/trustsys?create=1");
  }, [router]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      Redirecting to assessments...
    </div>
  );
}

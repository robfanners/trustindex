"use client";

import { VCCAuthProvider } from "@/context/VCCAuthContext";
import RequireAdminRole from "@/components/vcc/RequireAdminRole";
import VCCShell from "@/components/vcc/VCCShell";

export default function VerisumAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VCCAuthProvider>
      <RequireAdminRole>
        <VCCShell>{children}</VCCShell>
      </RequireAdminRole>
    </VCCAuthProvider>
  );
}

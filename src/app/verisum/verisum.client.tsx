"use client";

import AccessGate from "@/components/AccessGate";
import AppShell from "@/components/AppShell";

// Move the previous contents of src/app/verisum/page.tsx here unchanged.
export default function VerisumClient() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-12 space-y-6">
        <h1 className="text-3xl font-bold">Verisum Admin</h1>
        <p className="text-muted-foreground">This area is restricted to Verisum operators.</p>
        <AccessGate />
      </div>
    </AppShell>
  );
}

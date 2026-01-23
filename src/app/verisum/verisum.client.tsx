"use client";

import AccessGate from "@/components/AccessGate";

// Move the previous contents of src/app/verisum/page.tsx here unchanged.
export default function VerisumClient() {
  return (
    <main className="min-h-screen bg-verisum-white text-verisum-black p-12 space-y-6">
      <h1 className="text-3xl font-bold">Verisum Admin</h1>
      <p className="text-verisum-grey max-w-2xl">This area is restricted to Verisum operators.</p>
      <AccessGate />
    </main>
  );
}

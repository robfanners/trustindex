"use client";

import AccessGate from "@/components/AccessGate";

export default function VerisumLoginPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 p-12 space-y-6">
      <h1 className="text-3xl font-bold">Verisum Admin</h1>
      <p className="text-gray-700 max-w-2xl">This area is restricted to Verisum operators.</p>
      <AccessGate />
    </main>
  );
}

import { Suspense } from "react";
import VerisumClient from "./verisum.client";

export default function VerisumPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white text-gray-900 p-12" />}>
      <VerisumClient />
    </Suspense>
  );
}

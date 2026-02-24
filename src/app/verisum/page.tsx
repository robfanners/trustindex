import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import VerisumClient from "./verisum.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VerisumPage() {
  noStore();
  return (
    <Suspense fallback={<main className="min-h-screen bg-background text-foreground p-12" />}>
      <VerisumClient />
    </Suspense>
  );
}

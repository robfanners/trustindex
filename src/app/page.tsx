import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import HomeClient from "./home.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  noStore();
  return (
    <Suspense fallback={<main className="min-h-screen bg-white text-gray-900 p-12" />}>
      <HomeClient />
    </Suspense>
  );
}


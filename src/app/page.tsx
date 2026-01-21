import { Suspense } from "react";
import HomeClient from "./home.client";

export default function Home() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white text-gray-900 p-12" />}>
      <HomeClient />
    </Suspense>
  );
}


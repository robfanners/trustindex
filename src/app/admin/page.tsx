"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminHomePage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect immediately to the create survey page
    router.replace("/admin/new-run");
  }, [router]);

  // Show minimal loading state during redirect
  return (
    <main className="min-h-screen bg-verisum-white text-verisum-black p-12">
      <p className="text-verisum-grey">Redirecting...</p>
    </main>
  );
}

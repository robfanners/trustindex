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
    <main className="min-h-screen bg-background text-foreground p-12">
      <p className="text-muted-foreground">Redirecting...</p>
    </main>
  );
}

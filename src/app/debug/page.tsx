import AppShell from "@/components/AppShell";

export default function DebugPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10">
        <h1 className="text-2xl font-bold mb-4">Debug</h1>
        <pre className="bg-[#f5f5f5] p-4 rounded">
{JSON.stringify(
  {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 35) + "...",
  },
  null,
  2
)}
        </pre>
      </div>
    </AppShell>
  );
}


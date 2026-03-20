import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

export default function GovernLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </RequireAuth>
  );
}

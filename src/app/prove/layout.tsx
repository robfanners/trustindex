import AuthenticatedShell from "@/components/AuthenticatedShell";

export default function ProveLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

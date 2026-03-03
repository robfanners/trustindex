import AuthenticatedShell from "@/components/AuthenticatedShell";

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

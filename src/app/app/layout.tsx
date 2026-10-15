import type { Metadata } from "next";
import { AppShell } from "@/components/app/Shell";
import { WorkspaceProvider } from "@/components/app/Workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description: "OSCRA workspace: recurring buys, copy desks, trade review and staking from your own wallet.",
  robots: { index: false, follow: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}

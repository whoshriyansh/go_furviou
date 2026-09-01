import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { RequireAuth } from "@/components/dashboard/RequireAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-background">
        <DashboardSidebar />
        <main className="min-h-0 flex-1 overflow-auto p-8">{children}</main>
      </div>
    </RequireAuth>
  );
}

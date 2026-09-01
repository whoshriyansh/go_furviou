import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { RequireAuth } from "@/components/dashboard/RequireAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </RequireAuth>
  );
}

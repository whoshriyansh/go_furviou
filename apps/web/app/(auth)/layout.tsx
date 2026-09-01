import { SiteShell } from "@/components/site/SiteShell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteShell>
      <main className="blueprint-grid flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
          {children}
        </div>
      </main>
    </SiteShell>
  );
}

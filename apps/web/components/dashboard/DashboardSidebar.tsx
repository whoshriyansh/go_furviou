"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredUser, logout } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Details" },
  { href: "/dashboard/campaigns", label: "Campaign" },
  { href: "/dashboard/mailbox", label: "Mailbox" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const user = getStoredUser();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card px-4 py-6">
      <p className="font-heading text-xl">Furviou</p>
      <p className="mt-1 text-xs text-muted-foreground">Go</p>
      <p className="mt-6 text-sm font-medium">{user?.displayName || "Account"}</p>
      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              pathname === link.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Button variant="outline" size="sm" onClick={logout}>
        Logout
      </Button>
    </aside>
  );
}

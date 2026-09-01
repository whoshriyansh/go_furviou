"use client";

import { useEffect, useState } from "react";
import { getMe, getStoredUser, type AuthUser } from "@/lib/api/auth";

export default function DashboardDetailsPage() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => undefined);
  }, []);

  return (
    <section>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Account
      </p>
      <h1 className="font-heading mt-2 text-4xl">Details</h1>
      <div className="mt-8 max-w-md space-y-3 rounded-xl border border-border bg-card p-6">
        <p>
          <span className="text-muted-foreground">Name</span>
          <br />
          {user?.displayName || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Email</span>
          <br />
          {user?.email || "—"}
        </p>
      </div>
    </section>
  );
}

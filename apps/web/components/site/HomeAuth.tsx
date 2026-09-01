"use client";

import { useEffect, useState } from "react";
import { GoogleOneTap } from "@/components/GoogleOneTap";
import { getStoredUser } from "@/lib/api/auth";

export function HomeAuth() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setEmail(getStoredUser()?.email ?? null);
    sync();
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, []);

  return (
    <>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? <GoogleOneTap /> : null}
      {email ? (
        <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      ) : null}
    </>
  );
}

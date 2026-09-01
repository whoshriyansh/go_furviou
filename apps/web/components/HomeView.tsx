"use client";

import { useEffect, useState } from "react";
import { GoogleOneTap } from "./GoogleOneTap";
import { getStoredUser, type AuthUser } from "../lib/googleAuth";

export function HomeView() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, []);

  return (
    <main style={{ padding: 40 }}>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? <GoogleOneTap /> : null}
      <h1>Furviou</h1>
      {user ? (
        <p>Signed in as {user.displayName || user.email}</p>
      ) : (
        <p>
          <a href="/login">Login</a>
        </p>
      )}
    </main>
  );
}

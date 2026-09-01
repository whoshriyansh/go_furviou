"use client";

import { useEffect } from "react";
import { getToken } from "@/lib/api/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
    }
  }, []);

  if (typeof window !== "undefined" && !getToken()) {
    return null;
  }

  return children;
}

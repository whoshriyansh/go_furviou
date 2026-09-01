"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const app = clientId ? (
    <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
  ) : (
    children
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {app}
    </ThemeProvider>
  );
}

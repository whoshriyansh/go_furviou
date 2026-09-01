"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useState } from "react";
import { loginWithGoogleCredential } from "../lib/googleAuth";

export function GoogleSignInButton() {
  const [error, setError] = useState("");

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <p>Google login is not configured</p>;
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <GoogleLogin
        onSuccess={async (response) => {
          try {
            if (!response.credential) {
              setError("No credential returned from Google");
              return;
            }
            await loginWithGoogleCredential(response.credential);
            window.location.href = "/";
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
          }
        }}
        onError={() => setError("Google login failed")}
      />
      {error ? <p>{error}</p> : null}
    </GoogleOAuthProvider>
  );
}

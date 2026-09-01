"use client";

import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import {
  loginWithGoogleCredential,
  registerWithGoogleCredential,
} from "../lib/api/auth";

type GoogleSignInButtonProps = {
  mode?: "login" | "register";
};

export function GoogleSignInButton({
  mode = "login",
}: GoogleSignInButtonProps) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <p>Google login is not configured</p>;
  }

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        try {
          if (!response.credential) {
            toast.error("No credential returned from Google");
            return;
          }

          if (mode === "register") {
            await registerWithGoogleCredential(response.credential);
          } else {
            await loginWithGoogleCredential(response.credential);
          }

          window.location.href = "/";
        } catch (error) {
          console.error(`[auth.${mode}] Google button failed`, error);
        }
      }}
      onError={() => toast.error("Google login failed")}
    />
  );
}

"use client";

import { useGoogleOneTapLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { getToken, loginWithGoogleCredential } from "../lib/api/auth";

export function GoogleOneTap() {
  const [signedIn, setSignedIn] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getToken()));
    setReady(true);
  }, []);

  useGoogleOneTapLogin({
    disabled: !ready || signedIn,
    onSuccess: async (response) => {
      if (!response.credential) {
        return;
      }
      await loginWithGoogleCredential(response.credential);
      window.location.reload();
    },
    onError: () => undefined,
  });

  return null;
}

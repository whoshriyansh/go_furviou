export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function loginWithGoogleCredential(credential: string) {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Google login failed");
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  window.dispatchEvent(new Event("auth-changed"));

  return data as { token: string; user: AuthUser };
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
}

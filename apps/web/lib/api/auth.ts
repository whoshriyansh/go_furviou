import { ENDPOINTS } from "../services/Endpoints";
import { axiosInstance } from "../services/AxiosHandler";
import type { AuthResponse, AuthUser } from "../types/auth";
import { toast } from "sonner";

export type { AuthUser, AuthResponse };

function persistSession(data: AuthResponse) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  window.dispatchEvent(new Event("auth-changed"));
}

async function googleAuthRequest(url: string, credential: string) {
  console.info("[auth] Google credential exchange", { url });

  const { data } = await axiosInstance.post<AuthResponse>(
    url,
    { credential },
    { skipAuth: true },
  );

  if (!data?.token || !data?.user) {
    throw new Error("Invalid auth response");
  }

  persistSession(data);
  toast.success(`Signed in as ${data.user.displayName || data.user.email}`);
  return data;
}

export async function loginWithGoogleCredential(credential: string) {
  return googleAuthRequest(ENDPOINTS.AUTH.LOGIN, credential);
}

export async function registerWithGoogleCredential(credential: string) {
  return googleAuthRequest(ENDPOINTS.AUTH.REGISTER, credential);
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-changed"));
  window.location.href = "/login";
}

export async function getMe() {
  const { data } = await axiosInstance.get<{ user: AuthUser }>(ENDPOINTS.AUTH.ME);
  return data.user;
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const user = localStorage.getItem("user");
  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user) as AuthUser;
  } catch {
    console.error("[auth] Failed to parse stored user");
    return null;
  }
}

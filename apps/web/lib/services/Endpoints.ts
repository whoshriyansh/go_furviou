export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/google",
    REGISTER: "/api/auth/google",
    ME: "/api/auth/me",
  },
};

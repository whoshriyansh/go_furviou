export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/google",
    REGISTER: "/api/auth/google",
    ME: "/api/auth/me",
  },
  MAILBOXES: {
    LIST: "/api/mailboxes",
    GMAIL_CONNECT: "/api/mailboxes/gmail/connect",
    CHECK: (id: string) => `/api/mailboxes/${id}/check`,
    CHECK_ALL: "/api/mailboxes/check-all",
    REMOVE: (id: string) => `/api/mailboxes/${id}`,
  },
  CAMPAIGNS: {
    LIST: "/api/campaigns",
    ONE: (id: string) => `/api/campaigns/${id}`,
    LAUNCH: (id: string) => `/api/campaigns/${id}/launch`,
    PAUSE: (id: string) => `/api/campaigns/${id}/pause`,
    RESUME: (id: string) => `/api/campaigns/${id}/resume`,
    IMPORT: (id: string) => `/api/campaigns/${id}/leads/import`,
    LEADS: (id: string) => `/api/campaigns/${id}/leads`,
    SEND_NOW: (id: string) => `/api/campaigns/${id}/send-now`,
  },
  LEADS: {
    LIST: "/api/leads",
  },
};

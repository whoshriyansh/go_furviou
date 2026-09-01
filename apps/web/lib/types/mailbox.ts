export type MailboxStatus = "connected" | "needs_reauth" | "error" | "paused";

export type Mailbox = {
  _id: string;
  email: string;
  provider: "gmail" | "outlook" | "other";
  status: MailboxStatus;
  fromName?: string;
  createdAt: string;
  hasRefreshToken?: boolean;
  tokenExpiresAt?: string;
  sentToday?: number;
  dailyLimit?: number;
  lastCheckOk?: boolean;
  lastCheckMessage?: string;
};

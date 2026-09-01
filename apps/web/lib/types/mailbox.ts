export type Mailbox = {
  _id: string;
  email: string;
  provider: "gmail" | "outlook" | "other";
  status: "connected" | "needs_reauth" | "error" | "paused";
  fromName?: string;
  createdAt: string;
};

import { OAuth2Client } from "google-auth-library";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function mailboxOAuthClient() {
  const clientId = process.env.GOOGLE_MAILBOX_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MAILBOX_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_MAILBOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Gmail mailbox OAuth is not configured");
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export { GMAIL_SCOPES };

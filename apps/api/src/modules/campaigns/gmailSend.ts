import SendingAccount from "../../models/sendingAccount";
import { mailboxOAuthClient } from "../mailbox/gmailOAuth";

type OAuthAccount = {
  oauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  save: () => Promise<unknown>;
};

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeHeaderWord(text: string) {
  if (/^[\x20-\x7E]*$/.test(text)) {
    return text;
  }
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function encodeSubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, " ").trim() || "(no subject)";
  return encodeHeaderWord(clean);
}

function formatFrom(name: string | undefined, email: string) {
  if (!name?.trim()) {
    return email;
  }
  const trimmed = name.trim();
  if (/^[\x20-\x7E]*$/.test(trimmed)) {
    return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" <${email}>`;
  }
  return `${encodeHeaderWord(trimmed)} <${email}>`;
}

export function buildRfcMessage(input: {
  fromName?: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string;
}) {
  const rfcMessageId = input.messageId.startsWith("<")
    ? input.messageId
    : `<${input.messageId}>`;

  const headers = [
    `From: ${formatFrom(input.fromName, input.fromEmail)}`,
    `To: ${input.toEmail}`,
    `Subject: ${encodeSubject(input.subject)}`,
    `Message-ID: ${rfcMessageId}`,
  ];

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
    headers.push(`References: ${input.inReplyTo}`);
  }

  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=UTF-8");
  headers.push("Content-Transfer-Encoding: base64");

  const bodyB64 = Buffer.from(
    input.body.replace(/\r?\n/g, "\r\n"),
    "utf8",
  ).toString("base64");
  const wrapped = bodyB64.match(/.{1,76}/g)?.join("\r\n") || bodyB64;
  const mime = `${headers.join("\r\n")}\r\n\r\n${wrapped}`;

  return { raw: toBase64Url(mime), rfcMessageId };
}

export async function getValidAccessToken(account: OAuthAccount) {
  const oauth = account.oauth;
  if (!oauth?.accessToken && !oauth?.refreshToken) {
    throw new Error("Mailbox is not connected");
  }

  const client = mailboxOAuthClient();
  client.setCredentials({
    access_token: oauth?.accessToken,
    refresh_token: oauth?.refreshToken,
    expiry_date: oauth?.expiresAt?.getTime(),
  });

  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) {
    throw new Error("Could not refresh Gmail access");
  }

  const creds = client.credentials;
  if (oauth) {
    oauth.accessToken = creds.access_token || accessToken;
    if (creds.refresh_token) {
      oauth.refreshToken = creds.refresh_token;
    }
    if (creds.expiry_date) {
      oauth.expiresAt = new Date(creds.expiry_date);
    }
  }
  await account.save();

  return accessToken;
}

export async function sendGmailMessage(input: {
  accessToken: string;
  raw: string;
  threadId?: string;
}) {
  const payload: { raw: string; threadId?: string } = { raw: input.raw };
  if (input.threadId) {
    payload.threadId = input.threadId;
  }

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await response.json()) as {
    id?: string;
    threadId?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `Gmail send failed (${response.status})`);
  }

  return { id: data.id || "", threadId: data.threadId || "" };
}

export async function threadHasLeadReply(input: {
  accessToken: string;
  threadId: string;
  leadEmail: string;
  ourSentCount: number;
}) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(input.threadId)}?format=metadata&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${input.accessToken}` } },
  );

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as {
    messages?: {
      payload?: { headers?: { name: string; value: string }[] };
    }[];
  };
  const messages = data.messages || [];
  const lead = input.leadEmail.toLowerCase();

  const fromLead = messages.some((message) => {
    const from =
      message.payload?.headers?.find(
        (header) => header.name.toLowerCase() === "from",
      )?.value || "";
    return from.toLowerCase().includes(lead);
  });

  return fromLead || messages.length > input.ourSentCount;
}

export async function markMailboxNeedsReauth(accountId: string) {
  await SendingAccount.updateOne(
    { _id: accountId },
    { $set: { status: "needs_reauth" } },
  );
}

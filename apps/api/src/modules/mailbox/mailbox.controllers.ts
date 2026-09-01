import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import SendingAccount from "../../models/sendingAccount";
import { getValidAccessToken } from "../campaigns/gmailSend";
import { GMAIL_SCOPES, mailboxOAuthClient } from "./gmailOAuth";

function frontendUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
  );
}

function mailboxRedirect(query: string) {
  return `${frontendUrl()}/dashboard/mailbox?${query}`;
}

function serializeMailbox(
  box: {
    _id: unknown;
    email: string;
    provider: string;
    status: string;
    fromName?: string;
    createdAt?: Date;
    sentToday?: number;
    dailyLimit?: number;
    oauth?: { refreshToken?: string; expiresAt?: Date };
  },
  extra?: { lastCheckOk?: boolean; lastCheckMessage?: string },
) {
  const hasRefreshToken = Boolean(box.oauth?.refreshToken);
  const status =
    box.status === "connected" && !hasRefreshToken
      ? "needs_reauth"
      : box.status;

  return {
    _id: String(box._id),
    email: box.email,
    provider: box.provider,
    status,
    fromName: box.fromName,
    createdAt: box.createdAt,
    hasRefreshToken,
    tokenExpiresAt: box.oauth?.expiresAt,
    sentToday: box.sentToday ?? 0,
    dailyLimit: box.dailyLimit ?? 40,
    ...extra,
  };
}

async function verifyAccount(account: {
  email: string;
  status: string;
  oauth?: { accessToken: string; refreshToken: string; expiresAt: Date };
  save: () => Promise<unknown>;
}) {
  if (!account.oauth?.refreshToken) {
    account.status = "needs_reauth";
    await account.save();
    return {
      ok: false,
      message: "Reconnect Gmail. Google did not leave a refresh token.",
    };
  }

  try {
    const accessToken = await getValidAccessToken(account);
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!profileRes.ok) {
      throw new Error("Gmail rejected the access token");
    }
    account.status = "connected";
    await account.save();
    return { ok: true, message: "Connected. Tokens refresh automatically." };
  } catch (error) {
    account.status = "needs_reauth";
    await account.save();
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not refresh Gmail. Reconnect the mailbox.",
    };
  }
}

// Logged-in user starts Gmail connect. Login client is NOT used here.
export async function startGmailConnect(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server is not configured" });
    }

    const state = jwt.sign({ id: req.user.id, kind: "gmail" }, secret, {
      expiresIn: "10m",
    });

    const client = mailboxOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GMAIL_SCOPES,
      state,
      include_granted_scopes: false,
    });

    return res.json({ url });
  } catch (error) {
    console.error("[mailbox] startGmailConnect", error);
    return res.status(500).json({ message: "Could not start Gmail connect" });
  }
}

// Google redirects here (no Bearer header). We trust `state` instead.
export async function gmailCallback(req: Request, res: Response) {
  const secret = process.env.JWT_SECRET;

  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const oauthError = req.query.error;

    if (oauthError) {
      return res.redirect(mailboxRedirect("gmail=denied"));
    }

    if (!code || !state || !secret) {
      return res.redirect(mailboxRedirect("gmail=error"));
    }

    const decoded = jwt.verify(state, secret) as { id: string; kind?: string };
    if (decoded.kind !== "gmail") {
      return res.redirect(mailboxRedirect("gmail=error"));
    }

    const client = mailboxOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      return res.redirect(mailboxRedirect("gmail=error"));
    }

    client.setCredentials(tokens);
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const profile = (await profileRes.json()) as { emailAddress?: string };

    if (!profile.emailAddress) {
      return res.redirect(mailboxRedirect("gmail=error"));
    }

    const email = profile.emailAddress.toLowerCase();
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 55 * 60 * 1000);

    const existing = await SendingAccount.findOne({
      createdBy: decoded.id,
      email,
    });

    await SendingAccount.findOneAndUpdate(
      { createdBy: decoded.id, email },
      {
        createdBy: decoded.id,
        email,
        provider: "gmail",
        authType: "oauth2",
        status: "connected",
        oauth: {
          accessToken: tokens.access_token,
          refreshToken:
            tokens.refresh_token || existing?.oauth?.refreshToken || "",
          expiresAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.redirect(mailboxRedirect("gmail=connected"));
  } catch (error) {
    console.error("[mailbox] gmailCallback", error);
    return res.redirect(mailboxRedirect("gmail=error"));
  }
}

export async function listMailboxes(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const mailboxes = await SendingAccount.find({ createdBy: req.user.id }).sort({
    createdAt: -1,
  });

  return res.json({
    mailboxes: mailboxes.map((box) => serializeMailbox(box)),
  });
}

export async function checkMailbox(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const account = await SendingAccount.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!account) {
    return res.status(404).json({ message: "Mailbox not found" });
  }

  const result = await verifyAccount(account);
  return res.json({
    mailbox: serializeMailbox(account, {
      lastCheckOk: result.ok,
      lastCheckMessage: result.message,
    }),
  });
}

export async function checkAllMailboxes(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const accounts = await SendingAccount.find({ createdBy: req.user.id }).sort({
    createdAt: -1,
  });
  const mailboxes = [];
  for (const account of accounts) {
    const result = await verifyAccount(account);
    mailboxes.push(
      serializeMailbox(account, {
        lastCheckOk: result.ok,
        lastCheckMessage: result.message,
      }),
    );
  }

  return res.json({ mailboxes });
}

export async function removeMailbox(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const removed = await SendingAccount.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user.id,
  });

  if (!removed) {
    return res.status(404).json({ message: "Mailbox not found" });
  }

  return res.json({ message: "Mailbox removed" });
}

import { Schema, model, Types } from "mongoose";

interface OAuthConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface SendingAccount {
  createdBy: Types.ObjectId;
  email: string;
  fromName?: string;
  signature?: string;
  provider: "gmail" | "outlook" | "other";
  authType: "oauth2" | "smtp";
  oauth?: OAuthConfig;
  smtp?: SmtpConfig;
  imap?: ImapConfig;
  status: "connected" | "needs_reauth" | "error" | "paused";
  dailyLimit: number;
  sentToday: number;
  sentTodayResetAt?: Date;
}

const oauthSchema = new Schema<OAuthConfig>(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const smtpSchema = new Schema<SmtpConfig>(
  {
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    user: { type: String, required: true },
    pass: { type: String, required: true },
  },
  { _id: false },
);

const imapSchema = new Schema<ImapConfig>(
  {
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    user: { type: String, required: true },
    pass: { type: String, required: true },
  },
  { _id: false },
);

const sendingAccountSchema = new Schema<SendingAccount>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    fromName: String,
    signature: String,
    provider: {
      type: String,
      enum: ["gmail", "outlook", "other"],
      required: true,
    },
    authType: {
      type: String,
      enum: ["oauth2", "smtp"],
      required: true,
    },
    oauth: oauthSchema,
    smtp: smtpSchema,
    imap: imapSchema,
    status: {
      type: String,
      enum: ["connected", "needs_reauth", "error", "paused"],
      default: "connected",
    },
    dailyLimit: { type: Number, default: 40 },
    sentToday: { type: Number, default: 0 },
    sentTodayResetAt: Date,
  },
  { timestamps: true },
);

sendingAccountSchema.index({ createdBy: 1, email: 1 }, { unique: true });

export default model<SendingAccount>("SendingAccount", sendingAccountSchema);

import { Schema, model, Types } from "mongoose";

interface EmailMessage {
  campaignId: Types.ObjectId;
  campaignLeadId: Types.ObjectId;
  leadId: Types.ObjectId;
  sendingAccountId: Types.ObjectId;
  stepOrder: number;
  subject: string;
  rfcMessageId?: string;
  providerMessageId?: string;
  threadId?: string;
  inReplyTo?: string;
  status: "queued" | "sent" | "failed" | "bounced";
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  error?: string;
}

const emailMessageSchema = new Schema<EmailMessage>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    campaignLeadId: {
      type: Schema.Types.ObjectId,
      ref: "CampaignLead",
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    sendingAccountId: {
      type: Schema.Types.ObjectId,
      ref: "SendingAccount",
      required: true,
    },
    stepOrder: { type: Number, required: true },
    subject: { type: String, required: true },
    rfcMessageId: String,
    providerMessageId: String,
    threadId: String,
    inReplyTo: String,
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "bounced"],
      default: "queued",
    },
    sentAt: Date,
    openedAt: Date,
    clickedAt: Date,
    repliedAt: Date,
    error: String,
  },
  { timestamps: true },
);

emailMessageSchema.index({ providerMessageId: 1 }, { sparse: true });

export default model<EmailMessage>("EmailMessage", emailMessageSchema);

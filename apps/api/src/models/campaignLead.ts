import { Schema, model, Types } from "mongoose";

interface CampaignLead {
  campaignId: Types.ObjectId;
  leadId: Types.ObjectId;
  sendingAccountId: Types.ObjectId;
  status:
    | "queued"
    | "active"
    | "paused"
    | "replied"
    | "bounced"
    | "unsubscribed"
    | "completed"
    | "failed";
  currentStep: number;
  nextSendAt?: Date;
  lastSentAt?: Date;
  completedAt?: Date;
}

const campaignLeadSchema = new Schema<CampaignLead>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
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
    status: {
      type: String,
      enum: [
        "queued",
        "active",
        "paused",
        "replied",
        "bounced",
        "unsubscribed",
        "completed",
        "failed",
      ],
      default: "queued",
      index: true,
    },
    currentStep: { type: Number, default: 0 },
    nextSendAt: Date,
    lastSentAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

campaignLeadSchema.index({ campaignId: 1, leadId: 1 }, { unique: true });
campaignLeadSchema.index({ status: 1, nextSendAt: 1 });

export default model<CampaignLead>("CampaignLead", campaignLeadSchema);

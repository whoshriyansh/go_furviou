import { Schema, model, Types } from "mongoose";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DelayUnit = "minutes" | "hours" | "days";

export interface CampaignStep {
  order: number;
  delayValue: number;
  delayUnit: DelayUnit;
  subject: string;
  body: string;
  sendAsReply: boolean;
}

export interface Campaign {
  createdBy: Types.ObjectId;
  sequenceId?: Types.ObjectId;
  sendingAccountIds: Types.ObjectId[];
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  steps: CampaignStep[];
  dailySendingLimit: number;
  delayBetweenLeadsSeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendDays: DayOfWeek[];
  timezone: string;
  stopOnReply: boolean;
  stopOnAutoReply: boolean;
  autoEnrollNewLeads: boolean;
}

const campaignStepSchema = new Schema<CampaignStep>(
  {
    order: { type: Number, required: true },
    delayValue: { type: Number, default: 0 },
    delayUnit: {
      type: String,
      enum: ["minutes", "hours", "days"],
      default: "days",
    },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    sendAsReply: { type: Boolean, default: true },
  },
  { _id: true },
);

const campaignSchema = new Schema<Campaign>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sequenceId: {
      type: Schema.Types.ObjectId,
      ref: "Sequence",
    },
    sendingAccountIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "SendingAccount",
      },
    ],
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "archived"],
      default: "draft",
    },
    steps: { type: [campaignStepSchema], default: [] },
    dailySendingLimit: { type: Number, default: 40 },
    delayBetweenLeadsSeconds: { type: Number, default: 120 },
    sendWindowStart: { type: String, default: "09:00" },
    sendWindowEnd: { type: String, default: "18:00" },
    sendDays: {
      type: [String],
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      default: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
    timezone: { type: String, default: "UTC" },
    stopOnReply: { type: Boolean, default: true },
    stopOnAutoReply: { type: Boolean, default: false },
    autoEnrollNewLeads: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default model<Campaign>("Campaign", campaignSchema);

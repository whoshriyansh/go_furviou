import { Schema, model, Types } from "mongoose";

type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface Campaign {
  createdBy: Types.ObjectId;
  sequenceId: Types.ObjectId;
  sendingAccountIds: Types.ObjectId[];
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  dailySendingLimit: number;
  delayBetweenLeadsSeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendDays: DayOfWeek[];
  timezone: string;
  stopOnReply: boolean;
  stopOnAutoReply: boolean;
}

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
      required: true,
    },
    sendingAccountIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "SendingAccount",
        required: true,
      },
    ],
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "archived"],
      default: "draft",
    },
    dailySendingLimit: { type: Number, default: 50 },
    delayBetweenLeadsSeconds: { type: Number, default: 60 },
    sendWindowStart: { type: String, default: "09:00" },
    sendWindowEnd: { type: String, default: "17:00" },
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
  },
  { timestamps: true },
);

export default model<Campaign>("Campaign", campaignSchema);

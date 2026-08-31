import { Schema, model, Types } from "mongoose";

interface Lead {
  createdBy: Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  website?: string;
  phone?: string;
  iceBreaker?: string;
  variables: Map<string, string>;
  source: "csv" | "manual";
  status: "active" | "unsubscribed" | "bounced" | "invalid";
}

const leadSchema = new Schema<Lead>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    firstName: String,
    lastName: String,
    fullName: String,
    company: String,
    website: String,
    variables: {
      type: Map,
      of: String,
      default: {},
    },
    source: {
      type: String,
      enum: ["csv", "manual"],
      default: "csv",
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed", "bounced", "invalid"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

leadSchema.index({ createdBy: 1, email: 1 }, { unique: true });

export default model<Lead>("Lead", leadSchema);

import { Schema, model, Types } from "mongoose";

interface Lead {
  createdBy: Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  mobile?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  company?: string;
  jobTitle?: string;
  iceBreaker?: string;
  demoProject?: string;
  googleReviewCount?: string;
  averageRating?: string;
  city?: string;
  country?: string;
  notes?: string;
  source: "csv" | "manual";
  status: "active" | "unsubscribed" | "bounced" | "invalid";
  campaignIds: Types.ObjectId[];
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
    mobile: String,
    website: String,
    instagram: String,
    linkedin: String,
    company: String,
    jobTitle: String,
    iceBreaker: String,
    demoProject: String,
    googleReviewCount: String,
    averageRating: String,
    city: String,
    country: String,
    notes: String,
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
    campaignIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Campaign",
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

leadSchema.index({ createdBy: 1, email: 1 }, { unique: true });
leadSchema.index({ campaignIds: 1 });

export default model<Lead>("Lead", leadSchema);

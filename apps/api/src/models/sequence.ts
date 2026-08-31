import { Schema, model, Types } from "mongoose";

interface SequenceStep {
  order: number;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  subject: string;
  body: string;
  sendAsReply: boolean;
}

interface Sequence {
  createdBy: Types.ObjectId;
  name: string;
  steps: SequenceStep[];
}

const sequenceStepSchema = new Schema<SequenceStep>({
  order: { type: Number, required: true },
  delayValue: { type: Number, required: true, default: 0 },
  delayUnit: {
    type: String,
    enum: ["minutes", "hours", "days"],
    default: "days",
  },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  sendAsReply: { type: Boolean, default: true },
});

const sequenceSchema = new Schema<Sequence>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    steps: [sequenceStepSchema],
  },
  { timestamps: true },
);

export default model<Sequence>("Sequence", sequenceSchema);

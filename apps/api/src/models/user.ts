import { Schema, model } from "mongoose";

interface User {
  email: string;
  firstName?: string;
  displayName?: string;
  avatar?: string;
  isFromGoogle?: boolean;
  googleId?: string;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: String,
    displayName: String,
    avatar: String,
    isFromGoogle: { type: Boolean, default: false },
    googleId: String,
  },
  { timestamps: true },
);

export default model<User>("User", userSchema);

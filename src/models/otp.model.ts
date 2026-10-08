import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  email: string;
  hashedCode: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    hashedCode: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Auto delete when expiresAt is reached
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Otp = mongoose.model<IOtp>("Otp", otpSchema);

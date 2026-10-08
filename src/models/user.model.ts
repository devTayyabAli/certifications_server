import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "member" | "admin";

export interface IUser extends Document {
  email: string;
  role: UserRole;
  walletAddress?: string;
  walletNonce?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  /** Bumped on logout — every token issued before then stops working */
  tokenVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
    walletAddress: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    walletNonce: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", userSchema);

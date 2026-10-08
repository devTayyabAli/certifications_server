import mongoose, { Document, Schema, Types } from "mongoose";

export type CertificateStatus = "locked" | "unlocked" | "minted";

export interface ICertificate extends Document {
  user: Types.ObjectId;
  tokenId?: string;
  recipientName: string;
  recipientAddress: string;
  cohortName: string;
  cohortDateRange: string;
  network: string;
  chainId: number;
  status: CertificateStatus;
  /** When the learner passed the certificate module — the issue date */
  unlockedAt?: Date;
  txHash?: string;
  blockNumber?: number;
  mintedAt?: Date;
  metadataUri?: string;
  earnedBadgesCount: number;
  totalBadgesCount: number;
  verificationCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const certificateSchema = new Schema<ICertificate>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    tokenId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    // Follows the profile name; may be empty until the learner sets one
    recipientName: {
      type: String,
      default: "",
    },
    recipientAddress: {
      type: String,
      lowercase: true,
      trim: true,
    },
    cohortName: {
      type: String,
      default: "Cohort 01 — Si Her DeFi",
    },
    cohortDateRange: {
      type: String,
      default: "Sep 24 – Dec 3 2026",
    },
    network: {
      type: String,
      default: "Base Mainnet",
    },
    chainId: {
      type: Number,
      default: 8453,
    },
    status: {
      type: String,
      enum: ["locked", "unlocked", "minted"],
      default: "locked",
      index: true,
    },
    unlockedAt: {
      type: Date,
    },
    txHash: {
      type: String,
      sparse: true,
      trim: true,
    },
    blockNumber: {
      type: Number,
    },
    mintedAt: {
      type: Date,
    },
    metadataUri: {
      type: String,
    },
    earnedBadgesCount: {
      type: Number,
      default: 0,
    },
    totalBadgesCount: {
      type: Number,
      default: 12,
    },
    verificationCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Certificate = mongoose.model<ICertificate>("Certificate", certificateSchema);

import mongoose, { Document, Schema } from "mongoose";

export interface IPartner extends Document {
  tag: string;
  title: string;
  description: string;
  actionText: string;
  actionUrl: string;
  footerText: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    tag: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    actionText: {
      type: String,
      default: "Visit partner site ↗",
    },
    actionUrl: {
      type: String,
      default: "#",
    },
    footerText: {
      type: String,
      default: "Verified partner",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Partner = mongoose.model<IPartner>("Partner", partnerSchema);

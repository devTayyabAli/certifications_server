import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISettings extends Document {
  user: Types.ObjectId;
  emailNotifications: boolean;
  onChainVerificationPrivacy: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    onChainVerificationPrivacy: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Settings = mongoose.model<ISettings>("Settings", settingsSchema);

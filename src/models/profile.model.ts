import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProfile extends Document {
  user: Types.ObjectId;
  name: string;
  role: string;
  organization: string;
  socialLink: string;
  bio: string;
  photoUrl: string | null;
  prefilledFields: string[];
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      default: "",
      trim: true,
    },
    organization: {
      type: String,
      default: "",
      trim: true,
    },
    socialLink: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    prefilledFields: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);

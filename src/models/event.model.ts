import mongoose, { Document, Schema } from "mongoose";

export interface IEvent extends Document {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  date: Date;
  endDate?: Date;
  timeTba: boolean;
  partnerName?: string;
  link: string;
  linkIsPlaceholder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    id: { type: String, required: true, unique: true },
    kind: { type: String, default: "linkedin-live" },
    title: { type: String, required: true },
    subtitle: { type: String },
    date: { type: Date, required: true },
    endDate: { type: Date },
    timeTba: { type: Boolean, default: true },
    partnerName: { type: String },
    link: { type: String, required: true },
    linkIsPlaceholder: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Event = mongoose.model<IEvent>("Event", eventSchema);

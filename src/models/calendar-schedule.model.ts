import mongoose, { Document, Schema, Types } from "mongoose";
import { CALENDAR_TYPES, CalendarType } from "../constants/calendar";

export interface ICalendarSchedule extends Document {
  user: Types.ObjectId;
  module: Types.ObjectId;
  calendarType: CalendarType;
  sessionTitle: string;
  scheduledDate: Date;
  endDate?: Date;
  timezone?: string;
  status: "scheduled" | "cancelled" | "attended";
  createdAt: Date;
  updatedAt: Date;
}

const calendarScheduleSchema = new Schema<ICalendarSchedule>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    module: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: true,
      index: true,
    },
    calendarType: {
      type: String,
      enum: CALENDAR_TYPES,
      default: "google",
    },
    sessionTitle: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "attended"],
      default: "scheduled",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active schedules for the same user and module
calendarScheduleSchema.index({ user: 1, module: 1 }, { unique: true });

export const CalendarSchedule = mongoose.model<ICalendarSchedule>(
  "CalendarSchedule",
  calendarScheduleSchema
);

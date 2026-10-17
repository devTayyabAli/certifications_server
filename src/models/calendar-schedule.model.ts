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
  /**
   * An emailed calendar invite (see CalendarInviteService): who it went to and
   * the session as last sent, so a later change to the session sends an update.
   */
  invite?: {
    email: string;
    sequence: number;
    sentAt: Date;
    start: Date;
    end: Date;
    link: string;
    title: string;
    /** set once a cancellation has been sent */
    cancelledAt?: Date | null;
    /** the last send failure, retried on the next pass */
    error?: string | null;
  } | null;
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
    invite: {
      type: new Schema(
        {
          email: { type: String, required: true },
          sequence: { type: Number, default: 0 },
          sentAt: { type: Date, required: true },
          start: { type: Date, required: true },
          end: { type: Date, required: true },
          link: { type: String, default: "" },
          title: { type: String, default: "" },
          cancelledAt: { type: Date, default: null },
          error: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
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

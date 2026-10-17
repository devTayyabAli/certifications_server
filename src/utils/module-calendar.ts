import { env } from "../config/env";
import { IModule } from "../models/module.model";
import { ApiError } from "./api-error";

/** A real IANA time zone name the runtime knows ("Asia/Karachi"), not arbitrary text. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A module's live session as a calendar event. */
export function calendarEvent(moduleDoc: IModule) {
  const startDate = moduleDoc.scheduledDate;
  if (!startDate) throw ApiError.badRequest("This session doesn't have a date yet.");
  const endDate = moduleDoc.endDate || new Date(startDate.getTime() + 60 * 60 * 1000);
  return {
    uid: `module-${moduleDoc._id}@siherdefi.org`,
    title: moduleDoc.calendarTitle || `Si Her DeFi: ${moduleDoc.title}`,
    description:
      moduleDoc.calendarDescription ||
      `${moduleDoc.description}${moduleDoc.presenter ? `\n\nPresented by: ${moduleDoc.presenter}` : ""}`,
    location: moduleDoc.location || "Si Her DeFi Virtual Stage",
    startDate,
    endDate,
    // The live link when there is one, otherwise the module's own page
    url: moduleDoc.meetingLink || `${env.FRONTEND_URL.replace(/\/+$/, "")}/module/${moduleDoc.slug}`,
  };
}

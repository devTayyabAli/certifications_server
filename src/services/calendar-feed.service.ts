import { env } from "../config/env";
import { Module } from "../models/module.model";
import { User } from "../models/user.model";
import { calendarEvent } from "../modules/modules/module.service";
import { CalendarEventPayload, generateIcsFeed } from "../utils/calendar-generator";
import { calendarFeedToken, userIdFromCalendarFeedToken } from "../utils/crypto";
import { CmsEventsService } from "./cms-events.service";
import { ModuleCatalogService } from "./module-catalog.service";

const feedSecret = () => env.CALENDAR_FEED_SECRET || env.JWT_SECRET;

/**
 * The cohort calendar learners subscribe to by URL: every published session
 * and cohort event (e.g. LinkedIn Lives), each under a stable UID so CMS
 * changes (time, Ro.am link) update the event in their calendar app.
 */
export class CalendarFeedService {
  /** Links for one learner: the feed itself and one-click subscribe links per calendar app. */
  static links(userId: string, baseUrl: string) {
    const url = `${baseUrl}/feed/${calendarFeedToken(userId, feedSecret())}.ics`;
    const webcalUrl = url.replace(/^https?:/, "webcal:");
    return {
      url,
      webcalUrl,
      googleUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`,
      outlookUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent("Si Her DeFi")}`,
    };
  }

  /** The feed for a token, or null when the token is invalid or the learner's account is gone. */
  static async feedFor(token: string): Promise<string | null> {
    const userId = userIdFromCalendarFeedToken(token, feedSecret());
    if (!userId) return null;
    const user = await User.findById(userId).select("isActive");
    if (!user || !user.isActive) return null;
    return generateIcsFeed(await this.events());
  }

  static async events(): Promise<CalendarEventPayload[]> {
    await ModuleCatalogService.ensureSynced();
    const modules = await Module.find({ isPublished: true, scheduledDate: { $ne: null } }).sort({ scheduledDate: 1 });
    const cohortEvents = await CmsEventsService.getAllEvents();

    return [
      ...modules.map(calendarEvent),
      ...cohortEvents.map((e) => ({
        uid: `${e.id}@siherdefi.org`,
        title: e.kind === "linkedin-live" ? `Si Her DeFi LinkedIn Live: ${e.title}` : `Si Her DeFi: ${e.title}`,
        description: [e.subtitle, e.partnerName ? `With ${e.partnerName}` : ""].filter(Boolean).join("\n\n") || undefined,
        location: e.kind === "linkedin-live" ? "LinkedIn Live" : "Online",
        startDate: e.date,
        endDate: e.endDate,
        // The company page stands in until the event has its own link: not worth a "join" link
        url: e.linkIsPlaceholder ? undefined : e.link,
        allDay: !!e.timeTba,
      })),
    ];
  }
}

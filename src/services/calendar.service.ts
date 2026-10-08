import { Types } from "mongoose";
import { env } from "../config/env";
import { Module } from "../models/module.model";
import { ApiError } from "../utils/api-error";
import {
  CalendarEventPayload,
  generateGoogleCalendarUrl,
  generateIcsContent,
  generateOffice365CalendarUrl,
  generateOutlookCalendarUrl,
  parseValidDate,
  sanitizeCalendarUrl,
} from "../utils/calendar-generator";

export interface CalendarSessionInput {
  id: string;
  slug?: string;
  title: string;
  startDate: Date | string;
  endDate?: Date | string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  url?: string;
  timezone?: string;
  presenter?: string;
  weekLabel?: string;
  dateLabel?: string;
}

export interface GeneratedCalendarResult {
  session: CalendarSessionInput;
  event: CalendarEventPayload;
  googleCalendarUrl: string;
  outlookCalendarUrl: string;
  office365CalendarUrl: string;
  icsContent: string;
  filename: string;
  icsDownloadUrl: string;
  calendarActionUrl: string;
  formattedDate: string;
  formattedTime: string;
}

/**
 * Built-in fallback registry for cohort sessions when MongoDB is warming up or during offline dev
 */
const DEFAULT_COHORT_SESSIONS: Record<string, CalendarSessionInput> = {
  "global-stablecoin-market": {
    id: "global-stablecoin-market",
    slug: "global-stablecoin-market",
    title: "The Global Stablecoin Market",
    startDate: "2026-10-19T17:00:00Z",
    endDate: "2026-10-19T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    presenter: "KAST",
    weekLabel: "WEEK 04 · OCT 19",
    dateLabel: "WEEK 04 · OCT 19",
    description:
      "What actually backs a stablecoin, how they move across markets, and where regulation is heading. Presented by KAST.",
    meetingUrl: "https://siherdefi.org/module/global-stablecoin-market",
  },
  "portfolio-alerts-tokenizing-what-matters": {
    id: "portfolio-alerts-tokenizing-what-matters",
    slug: "portfolio-alerts-tokenizing-what-matters",
    title: "Rarible Meets Real World: Tokenizing What Matters",
    startDate: "2026-10-22T17:00:00Z",
    endDate: "2026-10-22T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    presenter: "Rarible",
    weekLabel: "WEEK 05 · OCT 22",
    dateLabel: "WEEK 05 · OCT 22",
    description:
      "Rarible Meets Real World: Tokenizing What Matters. Exploring RWA provenance and on-chain liquid markets on Base.",
    meetingUrl: "https://siherdefi.org/module/portfolio-alerts-tokenizing-what-matters",
  },
  "trading-with-confidence-derivatives": {
    id: "trading-with-confidence-derivatives",
    slug: "trading-with-confidence-derivatives",
    title: "Trading With Confidence: DEXs Demystified",
    startDate: "2026-10-29T17:00:00Z",
    endDate: "2026-10-29T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    presenter: "Blockchain.com",
    weekLabel: "WEEK 06 · OCT 29",
    dateLabel: "WEEK 06 · OCT 29",
    description:
      "Trading With Confidence: DEXs Demystified. Demystifying on-chain liquidity, slippage, and swap mechanics on Base.",
    meetingUrl: "https://siherdefi.org/module/trading-with-confidence-derivatives",
  },
  "decentralized-futures": {
    id: "decentralized-futures",
    slug: "decentralized-futures",
    title: "Decentralized Futures",
    startDate: "2026-11-05T17:00:00Z",
    endDate: "2026-11-05T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    presenter: "JupiterBlock Ventures",
    weekLabel: "WEEK 07 · NOV 5",
    dateLabel: "WEEK 07 · NOV 5",
    description:
      "Decentralized Futures. Deep dive into synthetic assets, on-chain order books, and decentralized futures settlements.",
    meetingUrl: "https://siherdefi.org/module/decentralized-futures",
  },
  "collective-capital-for-creators": {
    id: "collective-capital-for-creators",
    slug: "collective-capital-for-creators",
    title: "Collective Capital for Creators",
    startDate: "2026-09-24T17:00:00Z",
    endDate: "2026-09-24T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    presenter: "Artist Fund & Si Her DAO",
    weekLabel: "WEEK 01 · SEP 24",
    dateLabel: "WEEK 01 · SEP 24",
    description:
      "Hands-on intro: how community funds flow to creators and on-chain treasuries. Complete this task to unlock your on-chain certificate on Base.",
    meetingUrl: "https://siherdefi.org/module/collective-capital-for-creators",
  },
};

export class CalendarService {
  /**
   * Format human-readable date and time strings with timezone
   */
  static formatHumanDateTime(date: Date, endDate?: Date, tz = "UTC") {
    try {
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tz === "UTC" ? "UTC" : tz,
      });

      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: tz === "UTC" ? "UTC" : tz,
      });

      const formattedDate = dateFormatter.format(date);
      const startTime = timeFormatter.format(date);
      const endTime = endDate ? timeFormatter.format(endDate) : "";

      const formattedTime = endTime ? `${startTime} – ${endTime}` : startTime;

      return { formattedDate, formattedTime };
    } catch {
      return {
        formattedDate: date.toUTCString().split(" ").slice(0, 4).join(" "),
        formattedTime: `${date.toISOString().substring(11, 16)} UTC`,
      };
    }
  }

  /**
   * Generate calendar event data dynamically for any session/module
   */
  static generateCalendarEvent(session: CalendarSessionInput): GeneratedCalendarResult {
    if (!session || !session.title) {
      throw ApiError.badRequest("Session data with valid title is required");
    }

    const startDate = parseValidDate(session.startDate);
    const endDate = session.endDate
      ? parseValidDate(session.endDate)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const timezone = session.timezone || "UTC";
    const meetingUrl = sanitizeCalendarUrl(session.meetingUrl || session.url);

    // Stable UID per session for calendar idempotency
    const stableUid = `session-${session.slug || session.id}@siherdefi.org`;

    const eventPayload: CalendarEventPayload = {
      uid: stableUid,
      title: session.title.startsWith("Si Her DeFi")
        ? session.title
        : `Si Her DeFi: ${session.title}`,
      description: session.description || "Si Her DeFi Cohort Learning Session",
      location: session.location || "Si Her DeFi Virtual Stage",
      startDate,
      endDate,
      url: meetingUrl,
      timezone,
    };

    const googleCalendarUrl = generateGoogleCalendarUrl(eventPayload);
    const outlookCalendarUrl = generateOutlookCalendarUrl(eventPayload);
    const office365CalendarUrl = generateOffice365CalendarUrl(eventPayload);
    const icsContent = generateIcsContent(eventPayload);

    const safeSlug = (session.slug || session.id || "session")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-");
    const filename = `${safeSlug}.ics`;

    const icsDownloadUrl = `/api/calendar/session/${session.slug || session.id}`;
    const calendarActionUrl = `${env.FRONTEND_URL}/calendar?sessionId=${encodeURIComponent(
      session.slug || session.id
    )}`;

    const { formattedDate, formattedTime } = this.formatHumanDateTime(
      startDate,
      endDate,
      timezone
    );

    return {
      session: {
        ...session,
        startDate,
        endDate,
        meetingUrl,
      },
      event: eventPayload,
      googleCalendarUrl,
      outlookCalendarUrl,
      office365CalendarUrl,
      icsContent,
      filename,
      icsDownloadUrl,
      calendarActionUrl,
      formattedDate,
      formattedTime,
    };
  }

  /**
   * Resolve session/module data by ID or slug
   */
  static async resolveSession(sessionIdOrSlug: string): Promise<CalendarSessionInput> {
    if (!sessionIdOrSlug || typeof sessionIdOrSlug !== "string") {
      throw ApiError.badRequest("Valid session ID or slug is required");
    }

    const cleanId = sessionIdOrSlug.trim();
    const isObjectId = Types.ObjectId.isValid(cleanId);

    // If MongoDB is connected, attempt query from Module model
    const dbState = (Module.db as unknown as { readyState?: number })?.readyState;
    if (dbState === 1) {
      try {
        const moduleDoc = await Module.findOne(
          isObjectId ? { $or: [{ _id: cleanId }, { slug: cleanId }] } : { slug: cleanId }
        );

        if (moduleDoc) {
          return {
            id: moduleDoc._id.toString(),
            slug: moduleDoc.slug,
            title: moduleDoc.title,
            startDate: moduleDoc.scheduledDate || new Date("2026-10-19T17:00:00Z"),
            endDate: moduleDoc.endDate || new Date("2026-10-19T18:00:00Z"),
            timezone: moduleDoc.timezone || "UTC",
            location: moduleDoc.location || "Si Her DeFi Virtual Stage",
            description:
              moduleDoc.calendarDescription ||
              moduleDoc.description ||
              `Si Her DeFi Session: ${moduleDoc.title}`,
            meetingUrl: moduleDoc.meetingLink || undefined,
            presenter: moduleDoc.presenter,
            weekLabel: moduleDoc.dateLabel,
            dateLabel: moduleDoc.dateLabel,
          };
        }
      } catch {
        // Fallback to dictionary on DB query error
      }
    }

    // Check built-in fallback catalog
    const fallback = DEFAULT_COHORT_SESSIONS[cleanId];
    if (fallback) {
      return fallback;
    }

    // Try finding by fuzzy slug or title match in fallback
    const matchedKey = Object.keys(DEFAULT_COHORT_SESSIONS).find(
      (k) => cleanId.toLowerCase().includes(k) || k.includes(cleanId.toLowerCase())
    );
    if (matchedKey) {
      return DEFAULT_COHORT_SESSIONS[matchedKey];
    }

    throw ApiError.notFound(`Session with ID or slug '${cleanId}' was not found`);
  }

  /**
   * Get calendar data for a session/module by ID or slug
   */
  static async getSessionCalendarData(
    sessionIdOrSlug: string
  ): Promise<GeneratedCalendarResult> {
    const session = await this.resolveSession(sessionIdOrSlug);
    return this.generateCalendarEvent(session);
  }
}

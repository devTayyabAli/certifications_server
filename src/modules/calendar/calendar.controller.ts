import { Request, Response } from "express";
import { CALENDAR_LABELS, toCalendarType } from "../../constants/calendar";
import { CalendarSchedule } from "../../models/calendar-schedule.model";
import { CalendarFeedService } from "../../services/calendar-feed.service";
import { CalendarService } from "../../services/calendar.service";
import { EmailService } from "../../services/email.service";
import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { ModuleService } from "../modules/module.service";

export class CalendarController {
  /**
   * The learner's private subscription feed (every session, kept up to date).
   * Public, since calendar apps can't sign in: the signed token in the URL is the key.
   * GET /api/v1/calendar/feed/:token.ics
   */
  static getFeed = asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.file ?? "").replace(/\.ics$/i, "");
    const ics = await CalendarFeedService.feedFor(token);
    if (!ics) throw ApiError.notFound("Calendar not found");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="si-her-defi.ics"');
    // Personal (it holds session links) and refreshed by the calendar app itself
    res.setHeader("Cache-Control", "private, max-age=900");
    return res.send(ics);
  });

  /**
   * The signed-in learner's subscribe links (feed URL + one-click Google / Apple / Outlook)
   * GET /api/v1/calendar/feed-link
   */
  static getFeedLink = asyncHandler(async (req: Request, res: Response) => {
    // Behind Vercel's proxy the original scheme is in x-forwarded-proto
    const proto = String(req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
    const baseUrl = `${proto}://${req.get("host")}${req.baseUrl}`;
    return ApiResponse.success(res, {
      message: "Calendar subscription links",
      data: CalendarFeedService.links(String(req.user!._id), baseUrl),
    });
  });

  /**
   * Get all sessions scheduled by the authenticated user
   */
  static getMySchedule = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const schedules = await CalendarSchedule.find({
      user: userId,
      status: "scheduled",
    })
      .populate("module", "title slug week dateLabel presenter location")
      .sort({ scheduledDate: 1 });

    return ApiResponse.success(res, {
      message: "User scheduled sessions retrieved",
      data: schedules,
    });
  });

  /**
   * Schedule a module or session
   */
  static scheduleSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { moduleId } = req.body;
    const calendarType = toCalendarType(req.body?.calendarType);

    const result = await ModuleService.scheduleModuleSession(
      moduleId,
      userId,
      calendarType
    );

    return ApiResponse.success(res, {
      message: `Session added to ${CALENDAR_LABELS[calendarType]}`,
      data: result,
    });
  });

  /**
   * Remove a scheduled session
   */
  static unscheduleSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { moduleId } = req.body;

    const result = await ModuleService.unscheduleModuleSession(moduleId, userId);

    return ApiResponse.success(res, {
      message: "Session unscheduled",
      data: result,
    });
  });

  /**
   * Download generated RFC 5545 .ics file for a session
   * Supports GET /api/calendar/session/:sessionId and GET /api/calendar/:id/ics
   */
  static downloadSessionIcs = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId || req.params.id;
    if (!sessionId) {
      throw ApiError.badRequest("Session ID or slug is required");
    }

    const { filename, icsContent } = await CalendarService.getSessionCalendarData(sessionId);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(icsContent);
  });

  /**
   * Backwards-compatible alias for existing downloadIcs
   */
  static downloadIcs = CalendarController.downloadSessionIcs;

  /**
   * Get dynamic calendar URLs (Google, Outlook, Office 365, .ics link) for a session
   * GET /api/calendar/session/:sessionId/links
   */
  static getSessionCalendarLinks = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId || req.params.id;
    if (!sessionId) {
      throw ApiError.badRequest("Session ID or slug is required");
    }

    const calendarData = await CalendarService.getSessionCalendarData(sessionId);

    return ApiResponse.success(res, {
      message: "Session calendar links generated",
      data: {
        sessionId: calendarData.session.id,
        slug: calendarData.session.slug,
        title: calendarData.session.title,
        startDate: calendarData.session.startDate,
        endDate: calendarData.session.endDate,
        formattedDate: calendarData.formattedDate,
        formattedTime: calendarData.formattedTime,
        location: calendarData.session.location,
        googleCalendarUrl: calendarData.googleCalendarUrl,
        outlookCalendarUrl: calendarData.outlookCalendarUrl,
        office365CalendarUrl: calendarData.office365CalendarUrl,
        icsDownloadUrl: calendarData.icsDownloadUrl,
        calendarActionUrl: calendarData.calendarActionUrl,
      },
    });
  });

  /**
   * Send a session reminder email via Nodemailer
   * POST /api/calendar/session/:sessionId/reminder or POST /api/calendar/reminder
   */
  static sendSessionReminder = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId || req.body.sessionId || req.body.moduleId;
    const { recipientName, attachIcs = false } = req.body;

    // Never to an address supplied in the request — only the learner's own
    const email = req.user?.email;
    if (!email) {
      throw ApiError.unauthorized("Please sign in to get a reminder.");
    }

    if (!sessionId) {
      throw ApiError.badRequest("Session ID or slug is required");
    }

    const session = await CalendarService.resolveSession(sessionId);

    const emailResult = await EmailService.sendSessionReminderEmail(
      session,
      {
        email,
        name: recipientName || (req.user ? req.user.email.split("@")[0] : undefined),
      },
      { attachIcs: Boolean(attachIcs) }
    );

    return ApiResponse.success(res, {
      message: `Reminder email successfully dispatched to ${email}`,
      data: {
        success: emailResult.success,
        messageId: emailResult.messageId,
        previewUrl: emailResult.previewUrl,
        recipient: emailResult.recipient,
        session: {
          id: session.id,
          slug: session.slug,
          title: session.title,
          formattedDate: emailResult.calendarData.formattedDate,
          formattedTime: emailResult.calendarData.formattedTime,
        },
        calendarActionUrl: emailResult.calendarData.calendarActionUrl,
      },
    });
  });
}

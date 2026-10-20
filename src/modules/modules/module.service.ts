import { Types } from "mongoose";
import { env } from "../../config/env";
import { CalendarType } from "../../constants/calendar";
import { CalendarSchedule, ICalendarSchedule } from "../../models/calendar-schedule.model";
import { Certificate } from "../../models/certificate.model";
import { IModule, Module } from "../../models/module.model";
import { Profile } from "../../models/profile.model";
import { IUserProgress, UserProgress } from "../../models/progress.model";
import { IQuiz, Quiz } from "../../models/quiz.model";
import { CmsCertificateService } from "../../services/cms-certificate.service";
import { CmsModulesService } from "../../services/cms-modules.service";
import { CmsSpeaker, CmsSpeakerService } from "../../services/cms-speaker.service";
import {
  ModuleCatalogService,
  isQuizOpen,
  sessionState,
} from "../../services/module-catalog.service";
import { ApiError } from "../../utils/api-error";
import { generateGoogleCalendarUrl, generateIcsContent } from "../../utils/calendar-generator";
import { composeBadgeShare } from "../../utils/badge-share";
import { generateVerificationCode } from "../../utils/crypto";
import { calendarEvent, isTimeZone } from "../../utils/module-calendar";
import { CalendarInviteService, invitesEnabled } from "../../services/calendar-invite.service";
import { HttpStatus } from "../../constants/http-status";

/** Looks a published module up by slug or id. */
export async function findPublishedModule(slugOrId: string) {
  await ModuleCatalogService.ensureSynced();
  const slug = slugOrId.toLowerCase();
  const moduleDoc = Types.ObjectId.isValid(slugOrId)
    ? await Module.findOne({ _id: slugOrId, isPublished: true })
    : // Current slug first, then any earlier one (old links keep working)
      (await Module.findOne({ slug, isPublished: true })) ??
      (await Module.findOne({ slugHistory: slug, isPublished: true }));
  if (!moduleDoc) throw ApiError.notFound("Module not found");
  return moduleDoc;
}

function speakerItem(s: CmsSpeaker) {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    companyTag: s.companyTag,
    companyName: s.companyName,
    headshotUrl: s.headshotUrl,
    companyLogoUrl: s.companyLogoUrl,
    bio: s.bio,
    sessionTitle: s.sessionTitle,
    sessionDescription: s.sessionDescription,
    sessionDate: s.sessionDate,
    telegramHandle: s.telegramHandle,
    links: s.links,
  };
}

function quizSummary(quiz: IQuiz | undefined, progress: IUserProgress | null, open: boolean) {
  if (!quiz || !quiz.isActive || quiz.questions.length === 0) {
    return { available: false, questionCount: 0, maxAttempts: 0, attemptsUsed: 0, isPassed: false, isSkipped: false, isOpen: false };
  }
  const attempts = (progress?.quizAttempts ?? []).filter((a) => a.quiz.toString() === quiz._id.toString());
  const isPassed = attempts.some((a) => a.passed);
  return {
    available: true,
    isOpen: open,
    questionCount: quiz.questions.length,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    // Attempts in the current set (starting over sets the earlier ones aside)
    attemptsUsed: Math.min(attempts.filter((a) => !a.archived).length, quiz.maxAttempts),
    isPassed,
    // Skipped after every attempt: no badge, but the module counts as done
    isSkipped: !isPassed && (progress?.skippedQuizzes ?? []).some((s) => s.quiz.toString() === quiz._id.toString()),
  };
}

async function toModuleItem(
  m: IModule,
  ctx: {
    progress: IUserProgress | null;
    quiz?: IQuiz;
    schedule?: ICalendarSchedule | null;
    withSpeakers?: boolean;
    /** Already loaded, so the list doesn't look speakers up again per module */
    speakers?: CmsSpeaker[];
    share?: { x: string; linkedin: string } | null;
  }
) {
  const state = sessionState(m);
  // The learner's calendar record for this session. It counts only if it still
  // matches the session by title or by time: a record matching neither belongs
  // to another session (module records can be re-mapped when the CMS changes).
  const sameSlot =
    !!ctx.schedule &&
    !!m.scheduledDate &&
    Math.abs(new Date(ctx.schedule.scheduledDate).getTime() - m.scheduledDate.getTime()) <= 60 * 1000;
  const sameTitle = !!ctx.schedule && ctx.schedule.sessionTitle?.trim() === m.title?.trim();
  const schedule = ctx.schedule && (sameSlot || sameTitle) ? ctx.schedule : null;
  // Added before the session's date or time changed: the learner's calendar has
  // the old slot, so it's no longer shown as added
  const calendarOutdated = !!schedule && !sameSlot;
  const speakers = (
    ctx.speakers ?? (ctx.withSpeakers ? await ModuleCatalogService.speakersFor(m) : [])
  ).map(speakerItem);
  const completed = (ctx.progress?.completedModules ?? []).some((id) => id.toString() === m._id.toString());

  return {
    id: m._id,
    slug: m.slug,
    title: m.title,
    week: m.week,
    dateLabel: m.dateLabel,
    tag: m.tag,
    presenter: speakers[0]?.name || m.presenter,
    partnerName: m.partnerName || speakers[0]?.companyName || "",
    companyTag: speakers[0]?.companyTag || m.companyTag,
    description: m.description,
    aboutText: m.aboutText ?? [],
    thumbnailUrl: m.thumbnailUrl ?? null,
    bannerUrl: m.bannerUrl ?? null,
    videoUrl: m.videoUrl ?? null,
    chapters: m.chapters ?? [],
    scheduledDate: m.scheduledDate ?? null,
    endDate: m.endDate ?? null,
    location: m.location,
    // The join link is only useful (and only shown) around the live session
    liveLink: state === "live" || state === "upcoming" ? m.meetingLink ?? null : null,
    sessionState: state,
    // Older field kept for existing screens
    sessionStatus: state === "upcoming" ? "upcoming" : state === "live" ? "live" : "completed",
    isPrerequisiteForCertificate: m.isPrerequisiteForCertificate,
    isCompleted: completed,
    badge: { name: m.badgeName || `Week ${m.week} badge`, image: m.badgeImageUrl || "/Badge_earned.png" },
    quiz: quizSummary(ctx.quiz, ctx.progress, isQuizOpen(state, m.quizOpen)),
    isScheduled: !!schedule && !calendarOutdated,
    scheduledProvider: schedule?.calendarType ?? null,
    /** added to a calendar, but the session has moved since: add it again */
    calendarOutdated,
    addedToCalendarAt: schedule?.updatedAt ?? null,
    speakers,
    /** the post for this badge, with the CMS wording and the partner tags filled in */
    share: ctx.share ?? null,
  };
}

/** One share post per module, from the CMS wording and the partner handles. */
async function sharesFor(userId: Types.ObjectId, modules: IModule[]) {
  const [catalog, content, cert] = await Promise.all([
    CmsModulesService.getCatalog().catch(() => null),
    CmsCertificateService.getContent(),
    Certificate.findOne({ user: userId }, { status: 1, verificationCode: 1 }),
  ]);
  const link =
    cert && cert.status !== "locked" && cert.verificationCode
      ? `${env.FRONTEND_URL.replace(/\/+$/, "")}/credential/${encodeURIComponent(cert.verificationCode)}`
      : null;
  const cmsModules = catalog?.modules ?? [];
  const out = new Map<string, { x: string; linkedin: string }>();
  for (const m of modules) {
    const cms = cmsModules.find((c) => c.week === m.week) ?? cmsModules.find((c) => c.slug === m.slug);
    out.set(
      m._id.toString(),
      composeBadgeShare(
        { name: m.badgeName || `Week ${m.week} badge`, week: m.week, moduleTitle: m.title },
        cms,
        content,
        link
      )
    );
  }
  return out;
}

export { calendarEvent };

export class ModuleService {
  static async getAllModules(userId: Types.ObjectId) {
    await ModuleCatalogService.ensureSynced();
    // Invite updates go out at most once a minute. They must not hold the
    // module list: sending mail can take longer than loading the page.
    void CalendarInviteService.syncInvites();
    const modules = await Module.find({ isPublished: true }).sort({ week: 1, order: 1 });
    const [progress, schedules, quizzes, shares, speakerLists] = await Promise.all([
      UserProgress.findOne({ user: userId }),
      CalendarSchedule.find({ user: userId, status: "scheduled" }),
      Quiz.find({ module: { $in: modules.map((m) => m._id) } }),
      sharesFor(userId, modules),
      Promise.all(modules.map((m) => ModuleCatalogService.speakersFor(m))),
    ]);
    const scheduleMap = new Map(schedules.map((s) => [s.module.toString(), s]));
    const quizMap = new Map(quizzes.map((q) => [q.module.toString(), q]));

    return Promise.all(
      modules.map((m, index) =>
        toModuleItem(m, {
          progress,
          quiz: quizMap.get(m._id.toString()),
          schedule: scheduleMap.get(m._id.toString()) ?? null,
          speakers: speakerLists[index],
          share: shares.get(m._id.toString()) ?? null,
        })
      )
    );
  }

  static async getModuleBySlugOrId(slugOrId: string, userId: Types.ObjectId) {
    const moduleDoc = await findPublishedModule(slugOrId);
    const [progress, schedule, quiz, shares] = await Promise.all([
      UserProgress.findOne({ user: userId }),
      CalendarSchedule.findOne({ user: userId, module: moduleDoc._id, status: "scheduled" }),
      Quiz.findOne({ module: moduleDoc._id }),
      sharesFor(userId, [moduleDoc]),
    ]);
    return toModuleItem(moduleDoc, {
      progress,
      quiz: quiz ?? undefined,
      schedule: schedule ?? null,
      withSpeakers: true,
      share: shares.get(moduleDoc._id.toString()) ?? null,
    });
  }

  static async getCmsSpeakers() {
    return CmsSpeakerService.getCohortSpeakers();
  }

  /**
   * Records a module as completed on the learner's progress (not saved — the
   * caller saves). Only ever called after the module's quiz is passed. A
   * module that unlocks the certificate unlocks it here.
   */
  static async recordCompletion(progress: IUserProgress, moduleDoc: IModule, userId: Types.ObjectId) {
    const already = progress.completedModules.some((id) => id.toString() === moduleDoc._id.toString());
    if (!already) progress.completedModules.push(moduleDoc._id as Types.ObjectId);

    if (!moduleDoc.isPrerequisiteForCertificate) return false;
    progress.hasPassedPrerequisiteForCertificate = true;

    let certificate = await Certificate.findOne({ user: userId });
    if (!certificate) {
      const profile = await Profile.findOne({ user: userId });
      certificate = new Certificate({
        user: userId,
        recipientName: profile?.name || "",
        status: "unlocked",
        unlockedAt: new Date(),
        verificationCode: generateVerificationCode(),
      });
    } else if (certificate.status === "locked") {
      certificate.status = "unlocked";
      certificate.unlockedAt = new Date();
    }
    await certificate.save();
    return true;
  }

  static async scheduleModuleSession(
    slugOrId: string,
    userId: Types.ObjectId,
    calendarType: CalendarType = "google",
    timezone?: string
  ) {
    const moduleDoc = await findPublishedModule(slugOrId);
    const event = calendarEvent(moduleDoc);

    const schedule = await CalendarSchedule.findOneAndUpdate(
      { user: userId, module: moduleDoc._id },
      {
        user: userId,
        module: moduleDoc._id,
        calendarType,
        sessionTitle: moduleDoc.title,
        // the session's slot at the time it was added, to spot later date changes
        scheduledDate: event.startDate,
        endDate: event.endDate,
        // the learner's own zone (IANA, e.g. "Asia/Karachi"), for reminders in their time
        timezone: isTimeZone(timezone) ? timezone : "UTC",
        status: "scheduled",
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      moduleId: moduleDoc._id,
      slug: moduleDoc.slug,
      calendarType,
      scheduledDate: event.startDate,
      googleCalendarUrl: generateGoogleCalendarUrl(event),
      icsContent: generateIcsContent(event),
      icsDownloadUrl: `/api/v1/modules/${moduleDoc.slug}/calendar/ics`,
      schedule,
    };
  }

  /** Emails the learner a calendar invite for the session (updates follow automatically). */
  static async inviteModuleSession(slugOrId: string, userId: Types.ObjectId, timezone?: string) {
    if (!invitesEnabled()) throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Email invites aren't available right now.");
    const moduleDoc = await findPublishedModule(slugOrId);
    try {
      const { email, resent } = await CalendarInviteService.invite(moduleDoc, userId, timezone);
      return { success: true, slug: moduleDoc.slug, calendarType: "email" as const, sentTo: email, resent };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.error("❌ Calendar invite failed:", (err as Error).message);
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "We couldn't send the invite just now. Please try again in a moment.");
    }
  }

  static async unscheduleModuleSession(slugOrId: string, userId: Types.ObjectId) {
    const moduleDoc = await findPublishedModule(slugOrId);
    // an emailed invite is taken out of the learner's calendar too
    const existing = await CalendarSchedule.findOne({ user: userId, module: moduleDoc._id });
    if (existing) await CalendarInviteService.cancelFor(existing, moduleDoc);
    await CalendarSchedule.findOneAndDelete({ user: userId, module: moduleDoc._id });
    return {
      success: true,
      message: "Session schedule removed",
      moduleId: moduleDoc._id,
    };
  }

  static async getModuleCalendarLinks(slugOrId: string) {
    const moduleDoc = await findPublishedModule(slugOrId);
    const event = calendarEvent(moduleDoc);
    return {
      moduleId: moduleDoc._id,
      slug: moduleDoc.slug,
      title: moduleDoc.title,
      scheduledDate: event.startDate,
      endDate: event.endDate,
      googleCalendarUrl: generateGoogleCalendarUrl(event),
      icsContent: generateIcsContent(event),
      icsDownloadUrl: `/api/v1/modules/${moduleDoc.slug}/calendar/ics`,
    };
  }

  static async getModuleIcs(slugOrId: string) {
    const moduleDoc = await findPublishedModule(slugOrId);
    return {
      filename: `${moduleDoc.slug}-session.ics`,
      icsContent: generateIcsContent(calendarEvent(moduleDoc)),
    };
  }
}

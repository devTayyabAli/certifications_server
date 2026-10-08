import { Types } from "mongoose";
import { env } from "../../config/env";
import { CalendarType } from "../../constants/calendar";
import { CalendarSchedule } from "../../models/calendar-schedule.model";
import { Certificate } from "../../models/certificate.model";
import { IModule, Module } from "../../models/module.model";
import { Profile } from "../../models/profile.model";
import { IUserProgress, UserProgress } from "../../models/progress.model";
import { IQuiz, Quiz } from "../../models/quiz.model";
import { CmsSpeaker, CmsSpeakerService } from "../../services/cms-speaker.service";
import {
  ModuleCatalogService,
  isQuizOpen,
  sessionState,
} from "../../services/module-catalog.service";
import { ApiError } from "../../utils/api-error";
import { generateGoogleCalendarUrl, generateIcsContent } from "../../utils/calendar-generator";
import { generateVerificationCode } from "../../utils/crypto";

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
    return { available: false, questionCount: 0, maxAttempts: 0, attemptsUsed: 0, isPassed: false, isOpen: false };
  }
  const attempts = (progress?.quizAttempts ?? []).filter((a) => a.quiz.toString() === quiz._id.toString());
  return {
    available: true,
    isOpen: open,
    questionCount: quiz.questions.length,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    attemptsUsed: attempts.length,
    isPassed: attempts.some((a) => a.passed),
  };
}

async function toModuleItem(
  m: IModule,
  ctx: {
    progress: IUserProgress | null;
    quiz?: IQuiz;
    schedule?: string | null;
    withSpeakers?: boolean;
  }
) {
  const state = sessionState(m);
  const speakers = ctx.withSpeakers
    ? (await ModuleCatalogService.speakersFor(m)).map(speakerItem)
    : [];
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
    quiz: quizSummary(ctx.quiz, ctx.progress, isQuizOpen(state)),
    isScheduled: !!ctx.schedule,
    scheduledProvider: ctx.schedule ?? null,
    speakers,
  };
}

function calendarEvent(moduleDoc: IModule) {
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

export class ModuleService {
  static async getAllModules(userId: Types.ObjectId) {
    await ModuleCatalogService.ensureSynced();
    const modules = await Module.find({ isPublished: true }).sort({ week: 1, order: 1 });
    const [progress, schedules, quizzes] = await Promise.all([
      UserProgress.findOne({ user: userId }),
      CalendarSchedule.find({ user: userId, status: "scheduled" }),
      Quiz.find({ module: { $in: modules.map((m) => m._id) } }),
    ]);
    const scheduleMap = new Map(schedules.map((s) => [s.module.toString(), s.calendarType]));
    const quizMap = new Map(quizzes.map((q) => [q.module.toString(), q]));

    return Promise.all(
      modules.map((m) =>
        toModuleItem(m, {
          progress,
          quiz: quizMap.get(m._id.toString()),
          schedule: scheduleMap.get(m._id.toString()) ?? null,
          withSpeakers: true,
        })
      )
    );
  }

  static async getModuleBySlugOrId(slugOrId: string, userId: Types.ObjectId) {
    const moduleDoc = await findPublishedModule(slugOrId);
    const [progress, schedule, quiz] = await Promise.all([
      UserProgress.findOne({ user: userId }),
      CalendarSchedule.findOne({ user: userId, module: moduleDoc._id, status: "scheduled" }),
      Quiz.findOne({ module: moduleDoc._id }),
    ]);
    return toModuleItem(moduleDoc, {
      progress,
      quiz: quiz ?? undefined,
      schedule: schedule?.calendarType ?? null,
      withSpeakers: true,
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
    calendarType: CalendarType = "google"
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
        scheduledDate: event.startDate,
        endDate: event.endDate,
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

  static async unscheduleModuleSession(slugOrId: string, userId: Types.ObjectId) {
    const moduleDoc = await findPublishedModule(slugOrId);
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

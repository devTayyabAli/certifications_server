import { createHash } from "crypto";
import { IModule, Module } from "../models/module.model";
import { Quiz } from "../models/quiz.model";
import { CmsModule, CmsModulesService, CmsQuizQuestion } from "./cms-modules.service";
import { CmsSpeaker, CmsSpeakerService } from "./cms-speaker.service";

/**
 * Keeps the Module and Quiz collections in step with the CMS.
 *
 * Content is edited in the CMS, but learner progress (completed modules, quiz
 * attempts, calendar schedules, badges) references Module / Quiz documents by
 * id. Syncing CMS rows onto those documents — matched by CMS row id, then by
 * slug — keeps every learner's history attached when the team edits a title,
 * date or question.
 */

const SYNC_INTERVAL_MS = 60 * 1000;
/** Version of the CMS → database mapping (see the fingerprint in syncNow) */
const SYNC_VERSION = 3;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

function fingerprint(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function moduleFields(m: CmsModule) {
  return {
    source: "cms" as const,
    cmsRowId: m.cmsRowId,
    slug: m.slug,
    title: m.title,
    week: m.week,
    order: m.week,
    dateLabel: m.dateLabel,
    tag: "MODULE",
    presenter: m.speakerNames[0] || m.partner || "Si Her DeFi",
    companyTag: (m.partner || "SI HER DEFI").split(/\s+/)[0].toUpperCase().slice(0, 12),
    partnerName: m.partner,
    speakerNames: m.speakerNames,
    description: m.description || m.title,
    aboutText: m.aboutText,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    bannerUrl: m.bannerUrl ?? undefined,
    videoUrl: m.videoUrl ?? undefined,
    chapters: m.chapters,
    isPrerequisiteForCertificate: m.unlocksCertificate,
    isPublished: true,
    scheduledDate: m.startsAt ?? undefined,
    endDate: m.endsAt ?? undefined,
    meetingLink: m.liveLink ?? undefined,
    badgeName: m.badgeName,
    badgeImageUrl: m.badgeImage,
    // Calendar events use the CMS title/description — drop any older override
    calendarTitle: undefined,
    calendarDescription: undefined,
  };
}

function quizFields(m: CmsModule, questions: CmsQuizQuestion[]) {
  return {
    title: `Week ${m.week} quiz · ${m.title}`,
    maxAttempts: m.quizAttempts,
    // Default: every question correct
    passingScore: Math.min(m.passMark ?? questions.length, Math.max(questions.length, 1)),
    badgeRewardName: m.badgeName,
    badgeRewardImage: m.badgeImage,
    isActive: questions.length > 0,
    retryAfterHours: m.retryAfterHours,
    questions: questions.map((q, index) => ({
      questionNumber: index + 1,
      questionText: q.question,
      options: q.options,
      correctOption: q.correct,
      explanation: q.explanation,
      hintTimestamp: q.hintTimestamp ?? undefined,
      hintTitle: q.hintTitle || undefined,
    })),
  };
}

async function syncNow() {
  const catalog = await CmsModulesService.getCatalog();
  // No modules form (or it's empty) → leave whatever is in the database alone
  if (!catalog || catalog.modules.length === 0) return;

  const keptIds: string[] = [];

  for (const cms of catalog.modules) {
    const fields = moduleFields(cms);
    const questions = catalog.questionsByWeek.get(cms.week) ?? [];
    const quiz = quizFields(cms, questions);
    // Covers the quiz settings too, so editing only e.g. the retry wait still syncs.
    // Bump SYNC_VERSION when the mapping itself changes, to re-sync every module.
    const hash = fingerprint({ v: SYNC_VERSION, fields, quiz });

    let doc =
      (await Module.findOne({ cmsRowId: cms.cmsRowId })) ??
      (await Module.findOne({ slug: cms.slug }));

    // A module's URL doesn't follow title edits: an existing module keeps its
    // slug unless the team sets the Slug field explicitly
    const slug = doc && !cms.slugFromCms ? doc.slug : cms.slug;

    // Another document may already hold the slug (e.g. the row was re-created)
    if (doc && doc.slug !== slug) {
      const clash = await Module.findOne({ slug, _id: { $ne: doc._id } });
      if (clash) await Module.updateOne({ _id: clash._id }, { slug: `${clash.slug}-archived-${clash._id}`, isPublished: false });
    }

    if (!doc) doc = new Module({ ...fields, slug });
    keptIds.push(String(doc._id));
    if (doc.cmsHash === hash && doc.isPublished) continue;

    // Remember the old URL when the slug really does change
    const history = new Set(doc.slugHistory ?? []);
    if (doc.slug && doc.slug !== slug) history.add(doc.slug);
    history.delete(slug);

    doc.set({ ...fields, slug, slugHistory: [...history], cmsHash: hash });
    await doc.save();

    // One quiz per module; kept (inactive) when questions are removed so past
    // attempts stay attached to it
    await Quiz.findOneAndUpdate(
      { module: doc._id },
      { $set: { module: doc._id, ...quiz } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // Anything not in the CMS any more (old demo seed, removed rows) is hidden
  await Module.updateMany({ _id: { $nin: keptIds }, isPublished: true }, { isPublished: false });
}

export type SessionState = "upcoming" | "live" | "recorded" | "processing";

/**
 * Where a module's session is right now:
 *  upcoming   — before the live session
 *  live       — during the scheduled live window
 *  recorded   — the recording is published
 *  processing — the live session is over, recording not up yet
 */
export function sessionState(
  m: Pick<IModule, "videoUrl" | "scheduledDate" | "endDate">,
  now = new Date()
): SessionState {
  if (m.videoUrl) return "recorded";
  if (!m.scheduledDate) return "upcoming";
  if (now < m.scheduledDate) return "upcoming";
  const end = m.endDate ?? new Date(m.scheduledDate.getTime() + 60 * 60 * 1000);
  return now <= end ? "live" : "processing";
}

/** The quiz opens once the session has happened (live or recorded). */
export function isQuizOpen(state: SessionState) {
  return state === "recorded" || state === "processing";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class ModuleCatalogService {
  /** Pulls CMS changes into the database at most once a minute. */
  static async ensureSynced() {
    if (Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;
    if (!inFlight) {
      inFlight = syncNow()
        .catch((err) => console.warn("⚠️ Module catalog sync failed:", (err as Error).message))
        .finally(() => {
          lastSyncAt = Date.now();
          inFlight = null;
        });
    }
    await inFlight;
  }

  /**
   * Speakers for a module from the SI<3> Speakers table: the names listed on
   * the module if any, otherwise cohort speakers whose Session Title matches.
   */
  static async speakersFor(m: Pick<IModule, "title" | "speakerNames">): Promise<CmsSpeaker[]> {
    const names = (m.speakerNames ?? []).map(normalize).filter(Boolean);
    if (names.length > 0) {
      const all = await CmsSpeakerService.getAllSpeakers();
      return names
        .map((name) => all.find((s) => normalize(s.name) === name))
        .filter((s): s is CmsSpeaker => !!s);
    }
    const title = normalize(m.title);
    const cohort = await CmsSpeakerService.getCohortSpeakers();
    return cohort.filter((s) => {
      const session = normalize(s.sessionTitle ?? "");
      return session !== "" && (session === title || session.includes(title) || title.includes(session));
    });
  }
}

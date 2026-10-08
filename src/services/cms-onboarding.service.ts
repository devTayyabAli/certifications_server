import { CmsTableDef, cmsBoolean, cmsNumber, readCmsTable } from "./cms-table.service";

/**
 * Si Her Onboard content, managed by the Si Her team in the SI3 CMS
 * (project "SI3 Website" → Tables). Three tables:
 *
 *  - Si Her DeFi Onboarding           one row per part: copy, intro video, dashboard card
 *  - Si Her DeFi Onboarding Questions one row per question
 *  - Si Her DeFi Onboarding Socials   one row per account learners are asked to follow
 *
 * Every row has a "Part" column ("Part 1" / "Part 2") and rows can be switched
 * off with "Active" = false, so content can be prepared before it goes live.
 */

export type OnboardPart = "part1" | "part2";

export const ONBOARDING_TABLE: CmsTableDef = {
  slug: "si-her-defi-onboarding",
  name: "Si Her DeFi Onboarding",
  description:
    "Si Her Onboard content for the learner app — one row per part (Part 1 / Part 2). Questions and socials live in their own tables.",
  page: { section: "Onboarding" },
  fields: [
    { key: "part", columnId: "col-ob-part", name: "Part", type: "string", required: true, defaultValue: "Part 1" },
    { key: "active", columnId: "col-ob-active", name: "Active", type: "string", defaultValue: "true" },
    { key: "stepLabel", columnId: "col-ob-step-label", name: "Step Label", type: "string" },
    { key: "cardTitle", columnId: "col-ob-card-title", name: "Dashboard Card Title", type: "string", required: true },
    { key: "cardDescription", columnId: "col-ob-card-desc", name: "Dashboard Card Description", type: "text" },
    { key: "cardImage", columnId: "col-ob-card-image", name: "Dashboard Card Image", type: "image" },
    { key: "pageTitle", columnId: "col-ob-page-title", name: "Page Title", type: "string", required: true },
    { key: "pageSubtitle", columnId: "col-ob-page-subtitle", name: "Page Subtitle", type: "text" },
    {
      key: "videoUrl",
      columnId: "col-ob-video-url",
      name: "Intro Video URL",
      type: "url",
      // A CMS "Video" field only takes uploads, so a pasted link (YouTube…) may
      // live in a separate text field
      aliases: ["Video URL", "Intro Video Link", "Video Link"],
    },
    { key: "videoPoster", columnId: "col-ob-video-poster", name: "Intro Video Poster", type: "image", aliases: ["Video Poster"] },
    { key: "videoCaption", columnId: "col-ob-video-caption", name: "Video Caption", type: "string" },
    { key: "videoMinutes", columnId: "col-ob-video-minutes", name: "Video Length (minutes)", type: "number" },
    { key: "questionsMinutes", columnId: "col-ob-questions-minutes", name: "Questions Time (minutes)", type: "number" },
    { key: "videoTaskLabel", columnId: "col-ob-video-task", name: "Video Task Label", type: "string" },
    { key: "socialsHeading", columnId: "col-ob-socials-heading", name: "Socials Heading", type: "string" },
    { key: "socialsTaskLabel", columnId: "col-ob-socials-task", name: "Socials Task Label", type: "string" },
    { key: "questionsTaskLabel", columnId: "col-ob-questions-task", name: "Questions Task Label", type: "string" },
    { key: "taskNote", columnId: "col-ob-task-note", name: "Task Note", type: "text" },
    { key: "questionsHeader", columnId: "col-ob-questions-header", name: "Questions Header", type: "string" },
    { key: "questionsIntro", columnId: "col-ob-questions-intro", name: "Questions Intro", type: "text" },
    { key: "completionTitle", columnId: "col-ob-done-title", name: "Completion Title", type: "string" },
    { key: "completionMessage", columnId: "col-ob-done-message", name: "Completion Message", type: "text" },
    { key: "nextStepNote", columnId: "col-ob-next-note", name: "Next Step Note", type: "string" },
    { key: "dashboardDoneMessage", columnId: "col-ob-done-card", name: "Dashboard Done Message", type: "text" },
  ],
};

export const ONBOARDING_QUESTIONS_TABLE: CmsTableDef = {
  slug: "si-her-defi-onboarding-questions",
  name: "Si Her DeFi Onboarding Questions",
  description:
    "Questions learners answer in Si Her Onboard. One row per question; set Order to arrange them and Active = false to hide one.",
  page: {
    section: "Onboarding",
    list: "questions",
    itemId: (v, i) => `onboarding-q-${v.order || i + 1}`,
  },
  fields: [
    { key: "part", columnId: "col-obq-part", name: "Part", type: "string", required: true, defaultValue: "Part 1" },
    { key: "order", columnId: "col-obq-order", name: "Order", type: "number", required: true, defaultValue: 1 },
    { key: "question", columnId: "col-obq-question", name: "Question", type: "text", required: true },
    { key: "placeholder", columnId: "col-obq-placeholder", name: "Placeholder", type: "string" },
    { key: "hint", columnId: "col-obq-hint", name: "Hint", type: "string" },
    { key: "maxLength", columnId: "col-obq-max-length", name: "Max Characters", type: "number", defaultValue: 400 },
    { key: "required", columnId: "col-obq-required", name: "Required", type: "string", defaultValue: "true" },
    { key: "active", columnId: "col-obq-active", name: "Active", type: "string", defaultValue: "true" },
  ],
};

export const ONBOARDING_SOCIALS_TABLE: CmsTableDef = {
  slug: "si-her-defi-onboarding-socials",
  name: "Si Her DeFi Onboarding Socials",
  description:
    "Accounts learners are asked to follow in Si Her Onboard. Platform: x, linkedin, instagram, telegram, youtube or website.",
  page: {
    section: "Onboarding",
    list: "socials",
    itemId: (v, i) =>
      `onboarding-social-${(v.platform || v.label || String(i + 1)).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  },
  fields: [
    { key: "part", columnId: "col-obs-part", name: "Part", type: "string", required: true, defaultValue: "Part 1" },
    { key: "order", columnId: "col-obs-order", name: "Order", type: "number", required: true, defaultValue: 1 },
    { key: "platform", columnId: "col-obs-platform", name: "Platform", type: "string", required: true },
    { key: "label", columnId: "col-obs-label", name: "Label", type: "string", required: true },
    { key: "handle", columnId: "col-obs-handle", name: "Handle", type: "string" },
    { key: "url", columnId: "col-obs-url", name: "URL", type: "url", required: true, aliases: ["Link"] },
    { key: "required", columnId: "col-obs-required", name: "Required", type: "string", defaultValue: "true" },
    { key: "active", columnId: "col-obs-active", name: "Active", type: "string", defaultValue: "true" },
  ],
};

export interface OnboardingQuestion {
  id: string;
  order: number;
  question: string;
  placeholder: string;
  hint: string;
  maxLength: number;
  required: boolean;
}

export interface OnboardingSocial {
  id: string;
  order: number;
  platform: string;
  label: string;
  handle: string;
  url: string;
  required: boolean;
}

export interface OnboardingContent {
  part: OnboardPart;
  stepLabel: string;
  card: { title: string; description: string; imageUrl: string | null; doneMessage: string };
  page: { title: string; subtitle: string };
  video: { url: string | null; posterUrl: string | null; caption: string; minutes: number | null };
  questionsMinutes: number | null;
  tasks: { video: string; socials: string; questions: string };
  socialsHeading: string;
  taskNote: string;
  questionsHeader: string;
  questionsIntro: string;
  completion: { title: string; message: string; nextStepNote: string };
  questions: OnboardingQuestion[];
  socials: OnboardingSocial[];
}

const DEFAULT_MAX_ANSWER_LENGTH = 400;
const MAX_ANSWER_LENGTH_CAP = 5000;
const CACHE_TTL_MS = 60 * 1000;

let cache: { expiresAt: number; byPart: Map<OnboardPart, OnboardingContent | null> } | null = null;

/** "Part 1", "part1", "1" → "part1". Blank means Part 1 (the page has no Part field). */
function normalizePart(value: string | undefined): OnboardPart | null {
  if (!value?.trim()) return "part1";
  const digit = value.match(/\d+/)?.[0];
  if (digit === "1") return "part1";
  if (digit === "2") return "part2";
  return null;
}

/** Only absolute http(s) links or app-relative paths ever reach the browser. */
function safeUrl(value: string | undefined, { allowRelative = false } = {}): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (allowRelative && value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

function optionalNumber(value: string | undefined): number | null {
  const parsed = cmsNumber(value, NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function loadAll(): Promise<Map<OnboardPart, OnboardingContent | null>> {
  const [contentRows, questionRows, socialRows] = await Promise.all([
    readCmsTable(ONBOARDING_TABLE),
    readCmsTable(ONBOARDING_QUESTIONS_TABLE),
    readCmsTable(ONBOARDING_SOCIALS_TABLE),
  ]);

  const byPart = new Map<OnboardPart, OnboardingContent | null>();

  for (const part of ["part1", "part2"] as OnboardPart[]) {
    // Rows without a Page Title (e.g. an empty test submission) are ignored
    const row = (contentRows ?? []).find(
      (r) =>
        !!r.values.pageTitle?.trim() &&
        normalizePart(r.values.part) === part &&
        cmsBoolean(r.values.active, true)
    );
    const v = row?.values;
    if (!v || !v.pageTitle) {
      byPart.set(part, null);
      continue;
    }

    const questions: OnboardingQuestion[] = (questionRows ?? [])
      .filter(
        (r) =>
          normalizePart(r.values.part) === part &&
          cmsBoolean(r.values.active, true) &&
          !!r.values.question
      )
      .map((r) => ({
        id: r.rowId,
        order: cmsNumber(r.values.order, 0),
        question: r.values.question,
        placeholder: r.values.placeholder ?? "",
        hint: r.values.hint ?? "",
        maxLength: Math.min(
          Math.max(cmsNumber(r.values.maxLength, DEFAULT_MAX_ANSWER_LENGTH), 1),
          MAX_ANSWER_LENGTH_CAP
        ),
        required: cmsBoolean(r.values.required, true),
      }))
      .sort((a, b) => a.order - b.order);

    const socials: OnboardingSocial[] = (socialRows ?? [])
      .filter((r) => normalizePart(r.values.part) === part && cmsBoolean(r.values.active, true))
      .map((r) => ({
        id: r.rowId,
        order: cmsNumber(r.values.order, 0),
        platform: (r.values.platform ?? "website").toLowerCase().trim(),
        label: r.values.label ?? "",
        handle: r.values.handle ?? "",
        url: safeUrl(r.values.url) ?? "",
        required: cmsBoolean(r.values.required, true),
      }))
      // A social without a working link can't be followed — leave it out
      .filter((s) => s.url && s.label)
      .sort((a, b) => a.order - b.order);

    // The questions are the point of onboarding: without at least one, the
    // part isn't ready and must never be completable.
    if (questions.length === 0) {
      byPart.set(part, null);
      continue;
    }

    byPart.set(part, {
      part,
      stepLabel: v.stepLabel ?? "",
      card: {
        title: v.cardTitle || v.pageTitle,
        description: v.cardDescription ?? "",
        imageUrl: safeUrl(v.cardImage, { allowRelative: true }),
        doneMessage: v.dashboardDoneMessage ?? "",
      },
      page: { title: v.pageTitle, subtitle: v.pageSubtitle ?? "" },
      video: {
        url: safeUrl(v.videoUrl),
        posterUrl: safeUrl(v.videoPoster, { allowRelative: true }),
        caption: v.videoCaption ?? "",
        minutes: optionalNumber(v.videoMinutes),
      },
      questionsMinutes: optionalNumber(v.questionsMinutes),
      tasks: {
        video: v.videoTaskLabel ?? "",
        socials: v.socialsTaskLabel ?? "",
        questions: v.questionsTaskLabel ?? "",
      },
      socialsHeading: v.socialsHeading ?? "",
      taskNote: v.taskNote ?? "",
      questionsHeader: v.questionsHeader ?? "",
      questionsIntro: v.questionsIntro ?? "",
      completion: {
        title: v.completionTitle ?? "",
        message: v.completionMessage ?? "",
        nextStepNote: v.nextStepNote ?? "",
      },
      questions,
      socials,
    });
  }

  return byPart;
}

export class CmsOnboardingService {
  /**
   * Published content for one part, or `null` when the team hasn't set it up
   * (or switched it off) in the CMS. Cached for a minute, so CMS edits show
   * up in the app within ~60 seconds.
   */
  static async getPart(part: OnboardPart): Promise<OnboardingContent | null> {
    if (!cache || cache.expiresAt <= Date.now()) {
      try {
        cache = { expiresAt: Date.now() + CACHE_TTL_MS, byPart: await loadAll() };
      } catch (err) {
        console.warn("⚠️ Could not load onboarding content from SI3 CMS:", (err as Error).message);
        // Keep serving the last good copy if the CMS is briefly unreachable
        if (cache) return cache.byPart.get(part) ?? null;
        return null;
      }
    }
    return cache.byPart.get(part) ?? null;
  }
}

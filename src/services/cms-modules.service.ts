import { env } from "../config/env";
import { CmsTableDef, cmsBoolean, cmsNumber, readCmsTable } from "./cms-table.service";

/**
 * Cohort modules and their quizzes, managed by the Si Her team in the SI3 CMS
 * (Forms + Referrals → "Si Her DeFi Modules" and "Si Her DeFi Quiz Questions").
 *
 *  - One module row per week: title, schedule, artwork, recording, chapters,
 *    badge and whether passing it unlocks the certificate.
 *  - One quiz row per question, linked to its module by Week.
 *
 * Speakers are not repeated here: they come from the existing "SI<3> Speakers"
 * table, matched by the speaker's Session Title (or the module's Speakers list).
 */

export const MODULES_TABLE: CmsTableDef = {
  slug: "si-her-defi-modules",
  name: "Si Her DeFi Modules",
  description: "Cohort modules for the learner app — one row per week.",
  page: {
    section: "Modules",
    list: "modules",
    // Week is the module's identity on the page — editing the title keeps progress attached
    itemId: (v, i) => `module-week-${(v.week ?? "").match(/\d+/)?.[0] ?? `item-${i + 1}`}`,
  },
  fields: [
    { key: "week", columnId: "col-mod-week", name: "Week", type: "number", required: true },
    { key: "title", columnId: "col-mod-title", name: "Title", type: "string", required: true },
    { key: "slug", columnId: "col-mod-slug", name: "Slug", type: "string" },
    { key: "active", columnId: "col-mod-active", name: "Active", type: "string", defaultValue: "true" },
    { key: "sessionDate", columnId: "col-mod-date", name: "Session Date", type: "string" },
    { key: "startTime", columnId: "col-mod-start", name: "Start Time (UTC)", type: "string", aliases: ["Start Time"] },
    { key: "durationMinutes", columnId: "col-mod-duration", name: "Duration (minutes)", type: "number" },
    { key: "dateLabel", columnId: "col-mod-date-label", name: "Date Label", type: "string" },
    { key: "description", columnId: "col-mod-desc", name: "Description", type: "text" },
    { key: "about", columnId: "col-mod-about", name: "About", type: "text" },
    { key: "thumbnail", columnId: "col-mod-thumb", name: "Thumbnail", type: "image", aliases: ["Artwork", "Video Thumbnail"] },
    {
      key: "bannerImage",
      columnId: "col-mod-banner",
      name: "Dashboard Banner Image",
      type: "image",
      aliases: [
        "Banner",
        "Banner Image",
        "Dashboard Banner",
        "Card Banner",
        "Cover Image",
        "Header Image",
        "banner_image",
        "banner",
      ],
    },
    {
      key: "videoUrl",
      columnId: "col-mod-video",
      name: "Recording URL",
      type: "url",
      // Upload-only "Video" fields can be paired with a pasted-link text field
      aliases: ["Video URL", "Recording Link", "Video Link"],
    },
    { key: "chapters", columnId: "col-mod-chapters", name: "Chapters", type: "text" },
    { key: "speakers", columnId: "col-mod-speakers", name: "Speakers", type: "string" },
    { key: "partner", columnId: "col-mod-partner", name: "Partner", type: "string" },
    { key: "liveLink", columnId: "col-mod-live", name: "Live Session Link", type: "url", aliases: ["Meeting Link"] },
    { key: "badgeName", columnId: "col-mod-badge", name: "Badge Name", type: "string" },
    { key: "badgeImage", columnId: "col-mod-badge-img", name: "Badge Image", type: "image" },
    { key: "unlocksCertificate", columnId: "col-mod-cert", name: "Unlocks Certificate", type: "string", defaultValue: "false" },
    { key: "quizAttempts", columnId: "col-mod-attempts", name: "Quiz Attempts", type: "number", defaultValue: 3 },
    { key: "passMark", columnId: "col-mod-pass", name: "Pass Mark", type: "number" },
    {
      key: "retryAfterHours",
      columnId: "col-mod-retry",
      name: "Retry After (hours)",
      type: "number",
      defaultValue: 24,
      aliases: ["retry_after_hours", "Retry After Hours"],
    },
  ],
};

export const QUIZ_QUESTIONS_TABLE: CmsTableDef = {
  slug: "si-her-defi-quiz-questions",
  name: "Si Her DeFi Quiz Questions",
  description: "Module quiz questions — one row per question, linked to the module by Week.",
  page: { section: "Modules", list: "quiz_questions" },
  fields: [
    { key: "week", columnId: "col-qz-week", name: "Week", type: "number", required: true },
    { key: "order", columnId: "col-qz-order", name: "Order", type: "number", required: true },
    { key: "question", columnId: "col-qz-question", name: "Question", type: "text", required: true },
    { key: "optionA", columnId: "col-qz-a", name: "Option A", type: "string", required: true },
    { key: "optionB", columnId: "col-qz-b", name: "Option B", type: "string", required: true },
    { key: "optionC", columnId: "col-qz-c", name: "Option C", type: "string" },
    { key: "optionD", columnId: "col-qz-d", name: "Option D", type: "string" },
    { key: "correct", columnId: "col-qz-correct", name: "Correct Option", type: "string", required: true },
    { key: "explanation", columnId: "col-qz-explanation", name: "Explanation", type: "text" },
    { key: "hintTimestamp", columnId: "col-qz-hint-time", name: "Hint Timestamp", type: "string" },
    { key: "hintTitle", columnId: "col-qz-hint-title", name: "Hint Title", type: "string" },
    { key: "active", columnId: "col-qz-active", name: "Active", type: "string", defaultValue: "true" },
  ],
};

export type OptionKey = "A" | "B" | "C" | "D";

export interface CmsChapter {
  time: string;
  title: string;
}

export interface CmsModule {
  cmsRowId: string;
  week: number;
  title: string;
  slug: string;
  /** True when the team set the Slug field — otherwise it's derived from the title */
  slugFromCms: boolean;
  dateLabel: string;
  startsAt: Date | null;
  endsAt: Date | null;
  description: string;
  aboutText: string[];
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  videoUrl: string | null;
  chapters: CmsChapter[];
  speakerNames: string[];
  partner: string;
  liveLink: string | null;
  badgeName: string;
  badgeImage: string;
  unlocksCertificate: boolean;
  quizAttempts: number;
  /** null = every question must be correct */
  passMark: number | null;
  /** Hours before a fresh round of attempts once all are used; 0 = never */
  retryAfterHours: number;
}

export interface CmsQuizQuestion {
  week: number;
  order: number;
  question: string;
  options: { key: OptionKey; text: string }[];
  correct: OptionKey;
  explanation: string;
  hintTimestamp: string | null;
  hintTitle: string;
}

export interface CmsModuleCatalog {
  modules: CmsModule[];
  /** week → questions in order */
  questionsByWeek: Map<number, CmsQuizQuestion[]>;
  /** Rows that were skipped, so the team can see why something is missing */
  warnings: string[];
}

const DEFAULT_START_TIME = "17:00";
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_BADGE_IMAGE = "/Badge_earned.png";
const DEFAULT_RETRY_AFTER_HOURS = 24;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function safeUrl(value: string | undefined, { allowRelative = false } = {}): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (allowRelative && value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Time zones the team may write after a start time, e.g. "12:00 PM ET". */
const TIME_ZONES: Record<string, string> = {
  UTC: "UTC",
  GMT: "UTC",
  Z: "UTC",
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  CT: "America/Chicago",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MT: "America/Denver",
  MST: "America/Denver",
  MDT: "America/Denver",
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  UK: "Europe/London",
  BST: "Europe/London",
  CET: "Europe/Paris",
  CEST: "Europe/Paris",
  PKT: "Asia/Karachi",
  IST: "Asia/Kolkata",
  SGT: "Asia/Singapore",
};

/** Offset (ms) of an IANA zone from UTC at a given instant — handles daylight saving. */
function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

/** A wall-clock time in a zone → the real instant. */
function zonedToUtc(y: number, m: number, d: number, h: number, min: number, timeZone: string) {
  const guess = new Date(Date.UTC(y, m, d, h, min));
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  // Second pass settles times right next to a daylight-saving switch
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

/**
 * "17:00", "5:30 PM", "12:00 PM ET", "9am PT", "16:00 UTC" → hours, minutes
 * and time zone. No zone means UTC.
 */
function parseClock(value: string | undefined) {
  const text = (value || DEFAULT_START_TIME).trim();
  const m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*([a-z]{1,4})?\b/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? 0);
  const meridiem = m[3]?.toLowerCase().replace(/\./g, "");
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  const zoneKey = (m[4] ?? "UTC").toUpperCase();
  const timeZone = TIME_ZONES[zoneKey];
  if (hours > 23 || minutes > 59 || !timeZone) return null;
  return { hours, minutes, timeZone };
}

/** "2026-10-08" + "12:00 PM ET" → Date. Anything unparseable → null. */
export function parseStart(date: string | undefined, time: string | undefined): Date | null {
  if (!date) return null;
  const clock = parseClock(time);
  if (!clock) return null;

  let y: number, mo: number, d: number;
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    [y, mo, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
  } else {
    // Free text like "Oct 8, 2026" — only trusted when it names a year
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2024) return null;
    [y, mo, d] = [parsed.getFullYear(), parsed.getMonth(), parsed.getDate()];
  }
  const start = zonedToUtc(y, mo, d, clock.hours, clock.minutes, clock.timeZone);
  return Number.isNaN(start.getTime()) ? null : start;
}

/** One chapter per line: "3:15 Community allocation" or "3:15 — Community allocation". */
function parseChapters(value: string | undefined): CmsChapter[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—·|:]?\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ time: m[1], title: m[2].trim() }));
}

function parseParagraphs(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** "1", "Week 1", "WEEK 01" → 1 */
function parseWeek(value: string | undefined): number {
  const digits = (value ?? "").match(/\d+/)?.[0];
  return digits ? Number(digits) : NaN;
}

/**
 * Development only: move a session's live window for testing without
 * touching the CMS. `DEV_SESSION_OVERRIDES` is a comma-separated list of
 * `slug@ISO-start+minutes`, e.g.
 *   collective-capital-for-creators@2026-10-07T20:05:00Z+10
 * Ignored entirely outside NODE_ENV=development.
 */
function applyDevOverrides(modules: CmsModule[]) {
  if (env.NODE_ENV !== "development" || !env.DEV_SESSION_OVERRIDES) return;
  for (const entry of env.DEV_SESSION_OVERRIDES.split(",")) {
    const match = entry.trim().match(/^([a-z0-9-]+)@([^+]+)(?:\+(\d+))?$/i);
    const target = match && modules.find((m) => m.slug === match[1].toLowerCase());
    const start = match ? new Date(match[2]) : null;
    if (!match || !target || !start || Number.isNaN(start.getTime())) {
      console.warn(`⚠️ DEV_SESSION_OVERRIDES entry ignored: "${entry}"`);
      continue;
    }
    const minutes = match[3] ? Number(match[3]) : DEFAULT_DURATION_MINUTES;
    target.startsAt = start;
    target.endsAt = new Date(start.getTime() + minutes * 60 * 1000);
    target.dateLabel = defaultDateLabel(target.week, start);
    console.log(`🧪 [DEV] ${target.slug} live ${start.toISOString()} for ${minutes} min`);
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function defaultDateLabel(week: number, startsAt: Date | null) {
  const when = startsAt ? ` · ${MONTHS[startsAt.getUTCMonth()]} ${pad(startsAt.getUTCDate())}` : "";
  return `WEEK ${pad(week)}${when}`;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: CmsModuleCatalog | null } | null = null;

async function load(): Promise<CmsModuleCatalog | null> {
  const [moduleRows, questionRows] = await Promise.all([
    readCmsTable(MODULES_TABLE),
    readCmsTable(QUIZ_QUESTIONS_TABLE),
  ]);
  if (!moduleRows) return null;

  const warnings: string[] = [];
  const modules: CmsModule[] = [];
  const usedSlugs = new Set<string>();
  const usedWeeks = new Set<number>();

  for (const row of moduleRows) {
    const v = row.values;
    if (!cmsBoolean(v.active, true)) continue;
    const week = parseWeek(v.week);
    const title = v.title?.trim();
    if (!title && !v.week) continue; // blank row (e.g. an empty test submission)
    if (!Number.isInteger(week) || week < 1 || !title) {
      warnings.push(`Module row skipped — needs a Title and a whole-number Week (got "${v.title ?? ""}", "${v.week ?? ""}").`);
      continue;
    }
    if (usedWeeks.has(week)) {
      warnings.push(`Module "${title}" skipped — Week ${week} is already used by another active module.`);
      continue;
    }

    let slug = slugify(v.slug || title);
    if (usedSlugs.has(slug)) slug = `${slug}-week-${week}`;
    usedSlugs.add(slug);
    usedWeeks.add(week);

    const startsAt = parseStart(v.sessionDate, v.startTime);
    if (v.sessionDate && !startsAt) {
      warnings.push(
        `Module "${title}": couldn't read Session Date "${v.sessionDate}" / Start Time "${v.startTime ?? ""}" (use e.g. 2026-10-08 and "12:00 PM ET" or "16:00 UTC").`
      );
    }
    const duration = cmsNumber(v.durationMinutes, DEFAULT_DURATION_MINUTES);
    const passMark = cmsNumber(v.passMark, NaN);

    modules.push({
      cmsRowId: row.rowId,
      week,
      title,
      slug,
      slugFromCms: !!v.slug?.trim(),
      dateLabel: v.dateLabel || defaultDateLabel(week, startsAt),
      startsAt,
      endsAt: startsAt ? new Date(startsAt.getTime() + Math.max(duration, 1) * 60 * 1000) : null,
      description: v.description ?? "",
      aboutText: parseParagraphs(v.about),
      thumbnailUrl: safeUrl(v.thumbnail, { allowRelative: true }),
      bannerUrl: safeUrl(v.bannerImage, { allowRelative: true }),
      videoUrl: safeUrl(v.videoUrl),
      chapters: parseChapters(v.chapters),
      speakerNames: (v.speakers ?? "")
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      partner: v.partner ?? "",
      liveLink: safeUrl(v.liveLink),
      badgeName: v.badgeName || `Week ${week} · ${title}`,
      badgeImage: safeUrl(v.badgeImage, { allowRelative: true }) ?? DEFAULT_BADGE_IMAGE,
      unlocksCertificate: cmsBoolean(v.unlocksCertificate, false),
      quizAttempts: Math.min(Math.max(Math.round(cmsNumber(v.quizAttempts, 3)), 1), 10),
      passMark: Number.isFinite(passMark) && passMark > 0 ? Math.round(passMark) : null,
      retryAfterHours: Math.min(Math.max(cmsNumber(v.retryAfterHours, DEFAULT_RETRY_AFTER_HOURS), 0), 24 * 30),
    });
  }

  const questionsByWeek = new Map<number, CmsQuizQuestion[]>();
  for (const row of questionRows ?? []) {
    const v = row.values;
    if (!cmsBoolean(v.active, true)) continue;
    if (!v.question && !v.week) continue;
    const week = parseWeek(v.week);
    const correct = (v.correct ?? "").trim().toUpperCase().charAt(0) as OptionKey;
    const options = (["A", "B", "C", "D"] as OptionKey[])
      .map((key) => ({ key, text: (v[`option${key}`] ?? "").trim() }))
      .filter((o) => o.text);

    if (!Number.isInteger(week) || !v.question) {
      warnings.push(`Quiz row skipped — needs a Week and a Question.`);
      continue;
    }
    if (options.length < 2 || !options.some((o) => o.key === correct)) {
      warnings.push(
        `Week ${week} question "${v.question.slice(0, 40)}…" skipped — needs at least Option A and B, and a Correct Option (A–D) that has text.`
      );
      continue;
    }

    const list = questionsByWeek.get(week) ?? [];
    list.push({
      week,
      order: cmsNumber(v.order, list.length + 1),
      question: v.question,
      options,
      correct,
      explanation: v.explanation ?? "",
      hintTimestamp: /^\d{1,2}:\d{2}(:\d{2})?$/.test(v.hintTimestamp ?? "") ? v.hintTimestamp! : null,
      hintTitle: v.hintTitle ?? "",
    });
    questionsByWeek.set(week, list);
  }
  for (const list of questionsByWeek.values()) list.sort((a, b) => a.order - b.order);

  modules.sort((a, b) => a.week - b.week);
  applyDevOverrides(modules);
  return { modules, questionsByWeek, warnings };
}

export class CmsModulesService {
  /**
   * The module catalog as published in the CMS, or `null` when the modules
   * form hasn't been set up. Cached for a minute.
   */
  static async getCatalog(): Promise<CmsModuleCatalog | null> {
    if (!cache || cache.expiresAt <= Date.now()) {
      try {
        cache = { expiresAt: Date.now() + CACHE_TTL_MS, value: await load() };
      } catch (err) {
        console.warn("⚠️ Could not load modules from SI3 CMS:", (err as Error).message);
        if (cache) return cache.value;
        return null;
      }
    }
    return cache.value;
  }
}

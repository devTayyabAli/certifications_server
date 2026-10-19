import { CmsTableDef, cmsBoolean, readCmsTable } from "./cms-table.service";

/**
 * Si Her Onboard – Part 2: a short close-out reflection that opens when the
 * team switches Open on. Managed in the SI3 CMS on the "Si Her DeFi (Base)" page →
 * section "Onboarding Part 2": `title`, `subtitle`, and a `reflection_questions`
 * list (one item per question, in the order shown). Until that section exists
 * the default copy below is used.
 */

export const PART2_SECTION: CmsTableDef = {
  slug: "si-her-defi-onboarding-part-2",
  name: "Si Her DeFi Onboarding Part 2",
  description: "Title and subtitle of the Part 2 reflection page.",
  page: { section: "Onboarding Part 2" },
  fields: [
    { key: "title", columnId: "col-p2-title", name: "Title", type: "string" },
    { key: "subtitle", columnId: "col-p2-subtitle", name: "Subtitle", type: "text" },
    // the team's switch: Part 2 stays closed for everyone until this is on
    { key: "open", columnId: "col-p2-open", name: "Open", type: "string", aliases: ["Is Open", "Part 2 Open"] },
  ],
};

export const PART2_QUESTIONS: CmsTableDef = {
  slug: "si-her-defi-onboarding-part-2-questions",
  name: "Si Her DeFi Onboarding Part 2 Questions",
  description: "Part 2 reflection questions — one item per question, in order.",
  page: { section: "Onboarding Part 2", list: "reflection_questions" },
  fields: [
    { key: "question", columnId: "col-p2q-question", name: "Question", type: "text" },
    { key: "placeholder", columnId: "col-p2q-placeholder", name: "Placeholder", type: "string" },
    { key: "hint", columnId: "col-p2q-hint", name: "Hint", type: "string" },
    { key: "required", columnId: "col-p2q-required", name: "Required", type: "string" },
    { key: "active", columnId: "col-p2q-active", name: "Active", type: "string" },
  ],
};

export interface Part2Question {
  /** stable within the list: its position ("part2-q-1"…) */
  id: string;
  question: string;
  placeholder?: string;
  hint?: string;
  required: boolean;
}

export interface Part2Content {
  /** switched on by the team in the CMS; off (or missing) keeps Part 2 closed */
  open: boolean;
  title: string;
  subtitle: string;
  questions: Part2Question[];
}

const DEFAULT_CONTENT: Part2Content = {
  open: false,
  title: "Close out your cohort",
  subtitle:
    "Before you mint your certificate, take a few minutes to look back on the cohort and tell us where you’re heading next. Write as much or as little as you like.",
  questions: [
    { id: "part2-q-1", question: "What’s the most useful thing you learned in Si Her DeFi?", placeholder: "A concept, a tool, a conversation…", required: true },
    { id: "part2-q-2", question: "What will you do next with what you learned?", placeholder: "A project, a role, a habit, or a next course.", required: true },
    { id: "part2-q-3", question: "Anything we should change for the next cohort?", placeholder: "Optional. Honest feedback helps.", required: false },
  ],
};

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: Part2Content } | null = null;

export class CmsPart2Service {
  /** The Part 2 page copy and questions (CMS, else the defaults). Cached for a minute. */
  static async getContent(): Promise<Part2Content> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    let value = DEFAULT_CONTENT;
    try {
      const [head, rows] = await Promise.all([readCmsTable(PART2_SECTION), readCmsTable(PART2_QUESTIONS)]);
      const h = head?.[0]?.values ?? {};
      const questions = (rows ?? [])
        .filter((r) => r.values.question?.trim() && cmsBoolean(r.values.active, true))
        .map((r, i) => ({
          id: `part2-q-${i + 1}`,
          question: r.values.question.trim(),
          placeholder: r.values.placeholder?.trim() || undefined,
          hint: r.values.hint?.trim() || undefined,
          required: cmsBoolean(r.values.required, true),
        }));
      value = {
        open: cmsBoolean(h.open, false),
        title: h.title?.trim() || DEFAULT_CONTENT.title,
        subtitle: h.subtitle?.trim() || DEFAULT_CONTENT.subtitle,
        // the list, once set up, is the source; until then the default questions
        questions: rows !== null && questions.length > 0 ? questions : DEFAULT_CONTENT.questions,
      };
    } catch (err) {
      console.warn("⚠️ Could not load Part 2 content from SI3 CMS:", (err as Error).message);
      if (cache) return cache.value;
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}

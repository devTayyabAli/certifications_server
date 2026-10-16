import type { CmsSpeaker } from "./cms-speaker.service";
import { CmsRecord, CmsTableDef, cmsBoolean, readCmsTable, readPageSubsections } from "./cms-table.service";

/**
 * Speakers for the module pages, managed on the "Si Her DeFi (Base)" page →
 * section "Speakers". The clear way: one sub-section per module, named like
 * "Week 1 · Si Her Collective Capital", holding that module's `speakers` list
 * (1, 2, 3 or more, in the order the cards appear). A sub-section's speakers
 * only ever show on its own module.
 *
 * A `speakers` list directly on the section also works: each speaker belongs
 * to the module(s) in its `week` field (one week, or several like "1, 3, 5";
 * there is also an optional `weeks` field for when Week is a number field), or,
 * with no week, to modules naming them in their own Speakers field. Modules with nobody here fall back to the
 * shared "SI<3> Speakers" table.
 */
export const MODULE_SPEAKERS: CmsTableDef = {
  slug: "si-her-defi-speakers",
  name: "Si Her DeFi Speakers",
  description: "Speaker cards on the module pages — one item per speaker.",
  page: {
    section: "Speakers",
    list: "speakers",
    itemId: (v, i) => `speaker-${(v.name || String(i + 1)).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  },
  fields: [
    { key: "name", columnId: "col-spk-name", name: "Name", type: "string" },
    { key: "week", columnId: "col-spk-week", name: "Week", type: "string", aliases: ["Module Week", "Module"] },
    { key: "weeks", columnId: "col-spk-weeks", name: "Weeks", type: "string", aliases: ["Other Weeks", "More Weeks", "Also Weeks", "Sessions"] },
    { key: "title", columnId: "col-spk-title", name: "Title", type: "string", aliases: ["Role", "Job Title"] },
    { key: "company", columnId: "col-spk-company", name: "Company", type: "string", aliases: ["Organization", "Organisation"] },
    { key: "logo", columnId: "col-spk-logo", name: "Company Logo", type: "image", aliases: ["Logo", "CompanyLogo"] },
    { key: "photo", columnId: "col-spk-photo", name: "Photo", type: "image", aliases: ["Headshot", "Image", "Picture"] },
    { key: "bio", columnId: "col-spk-bio", name: "Bio", type: "text" },
    { key: "linkedin", columnId: "col-spk-linkedin", name: "LinkedIn", type: "url" },
    { key: "x", columnId: "col-spk-x", name: "X", type: "url", aliases: ["Twitter", "X Link"] },
    { key: "website", columnId: "col-spk-website", name: "Website", type: "url" },
    { key: "telegram", columnId: "col-spk-telegram", name: "Telegram", type: "string", aliases: ["Telegram Handle"] },
    { key: "active", columnId: "col-spk-active", name: "Active", type: "string" },
  ],
};

export interface ModuleSpeaker extends CmsSpeaker {
  /** the modules (by week) this speaker presents; empty when the CMS doesn't say */
  weeks: number[];
}

/** Links shown to learners: http(s) only; a bare handle like "@kara" becomes its profile link. */
function link(value: string | undefined, profileBase?: string): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (profileBase && /^@?[\w.-]{1,60}$/.test(v)) return `${profileBase}${v.replace(/^@/, "")}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`;
  return undefined;
}

function image(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  return v.startsWith("/") && !v.startsWith("//") ? v : undefined;
}

function weekOf(value: string | undefined): number | null {
  const digits = (value ?? "").match(/\d+/)?.[0];
  return digits ? Number(digits) : null;
}

/** Every week in "1", "1, 3, 5" or "Week 2 & Week 4", in order, without repeats. */
function weeksOf(...values: (string | undefined)[]): number[] {
  const all = values.flatMap((v) => (v ?? "").match(/\d+/g) ?? []).map(Number);
  return [...new Set(all)];
}

/** One CMS speaker item → a speaker card for `week`; null when it has no name or is switched off. */
function toSpeaker(r: CmsRecord, weeks: number[]): ModuleSpeaker | null {
  const v = r.values;
  if (!v.name?.trim() || !cmsBoolean(v.active, true)) return null;
  const company = v.company?.trim() ?? "";
  return {
    id: r.rowId,
    name: v.name.trim(),
    weeks,
    role: v.title?.trim() ?? "",
    companyName: company,
    companyTag: company,
    headshotUrl: image(v.photo),
    companyLogoUrl: image(v.logo),
    bio: v.bio?.trim() || undefined,
    telegramHandle: v.telegram?.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "") || undefined,
    links: {
      linkedin: link(v.linkedin, "https://www.linkedin.com/in/"),
      x: link(v.x, "https://x.com/"),
      website: link(v.website),
    },
  };
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: ModuleSpeaker[] | null } | null = null;

export class CmsModuleSpeakersService {
  /** Every active speaker in the CMS Speakers section, in list order; `null` when the section isn't set up. */
  static async getAll(): Promise<ModuleSpeaker[] | null> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    let value: ModuleSpeaker[] | null = null;
    try {
      const [rows, groups] = await Promise.all([readCmsTable(MODULE_SPEAKERS), readPageSubsections(MODULE_SPEAKERS)]);
      // per-module sub-sections first: the module comes from the sub-section,
      // whatever (if anything) each item's own Week says
      const fromGroups = (groups ?? []).flatMap((g) => {
        const week = weekOf(g.values.week) ?? weekOf(g.title.match(/\bweek\s*0*(\d+)/i)?.[1]);
        if (week === null) {
          console.warn(`⚠️ Speakers sub-section "${g.title}" skipped — name it "Week N · Module title".`);
          return [];
        }
        return g.rows.map((r) => toSpeaker(r, [week])).filter((s): s is ModuleSpeaker => s !== null);
      });
      const fromList = (rows ?? []).map((r) => toSpeaker(r, weeksOf(r.values.week, r.values.weeks))).filter((s): s is ModuleSpeaker => s !== null);
      value = rows === null && groups === null ? null : [...fromGroups, ...fromList];
    } catch (err) {
      console.warn("⚠️ Could not load speakers from SI3 CMS:", (err as Error).message);
      if (cache) return cache.value;
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}

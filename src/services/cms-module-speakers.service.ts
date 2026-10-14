import type { CmsSpeaker } from "./cms-speaker.service";
import { CmsTableDef, cmsBoolean, readCmsTable } from "./cms-table.service";

/**
 * Speakers for the module pages, managed on the "Si Her DeFi (Base)" page →
 * section "Speakers" → `speakers` list (one item per speaker, in the order the
 * cards should appear). A speaker belongs to a module by its `week`, or by
 * being named in that module's `speakers` field. Modules with nobody here
 * still fall back to the shared "SI<3> Speakers" table.
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
    { key: "title", columnId: "col-spk-title", name: "Title", type: "string", aliases: ["Role", "Job Title"] },
    { key: "company", columnId: "col-spk-company", name: "Company", type: "string", aliases: ["Organization", "Organisation"] },
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
  /** the module this speaker presents, when set in the CMS */
  week: number | null;
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

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: ModuleSpeaker[] | null } | null = null;

export class CmsModuleSpeakersService {
  /** Every active speaker in the CMS Speakers section, in list order; `null` when the section isn't set up. */
  static async getAll(): Promise<ModuleSpeaker[] | null> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    let value: ModuleSpeaker[] | null = null;
    try {
      const rows = await readCmsTable(MODULE_SPEAKERS);
      value = rows
        ? rows
            .filter((r) => r.values.name?.trim() && cmsBoolean(r.values.active, true))
            .map((r) => {
              const v = r.values;
              const weekDigits = (v.week ?? "").match(/\d+/)?.[0];
              const company = v.company?.trim() ?? "";
              return {
                id: r.rowId,
                name: v.name.trim(),
                week: weekDigits ? Number(weekDigits) : null,
                role: v.title?.trim() ?? "",
                companyName: company,
                companyTag: company,
                headshotUrl: image(v.photo),
                bio: v.bio?.trim() || undefined,
                telegramHandle: v.telegram?.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "") || undefined,
                links: {
                  linkedin: link(v.linkedin, "https://www.linkedin.com/in/"),
                  x: link(v.x, "https://x.com/"),
                  website: link(v.website),
                },
              };
            })
        : null;
    } catch (err) {
      console.warn("⚠️ Could not load speakers from SI3 CMS:", (err as Error).message);
      if (cache) return cache.value;
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}

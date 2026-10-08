import { CmsTableDef, cmsBoolean, cmsNumber, readCmsTable } from "./cms-table.service";

/**
 * Dashboard content managed in the CMS on the Si Her DeFi (Base) page:
 *  - section "Partners"  → list "partners" (one item per partner card)
 *  - section "More Ways" → heading / subheading, and list "cards"
 */

export const PARTNERS_LIST: CmsTableDef = {
  slug: "si-her-defi-partners",
  name: "Si Her DeFi Partners",
  description: "Partner cards on the learner dashboard.",
  page: {
    section: "Partners",
    list: "partners",
    itemId: (v, i) => `partner-${(v.title || String(i + 1)).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  },
  fields: [
    { key: "order", columnId: "col-p-order", name: "Order", type: "number" },
    { key: "title", columnId: "col-p-title", name: "Title", type: "string", aliases: ["Name"] },
    { key: "tag", columnId: "col-p-tag", name: "Tag", type: "string" },
    { key: "description", columnId: "col-p-desc", name: "Description", type: "text" },
    { key: "image", columnId: "col-p-image", name: "Image", type: "image", aliases: ["Logo", "Banner", "Image Link"] },
    { key: "actionText", columnId: "col-p-action", name: "Action Text", type: "string", aliases: ["Button Text"] },
    { key: "actionUrl", columnId: "col-p-url", name: "Action URL", type: "url", aliases: ["Link", "URL", "Button Link"] },
    { key: "footerText", columnId: "col-p-footer", name: "Footer Text", type: "string" },
    { key: "active", columnId: "col-p-active", name: "Active", type: "string", defaultValue: "true" },
  ],
};

export const MORE_WAYS_SECTION: CmsTableDef = {
  slug: "si-her-defi-more-ways",
  name: "Si Her DeFi More Ways",
  description: "The 'More ways to build' banner on the learner dashboard.",
  page: { section: "More Ways" },
  fields: [
    { key: "heading", columnId: "col-mw-heading", name: "Heading", type: "string" },
    { key: "subheading", columnId: "col-mw-sub", name: "Subheading", type: "text" },
  ],
};

export const MORE_WAYS_CARDS: CmsTableDef = {
  slug: "si-her-defi-more-ways-cards",
  name: "Si Her DeFi More Ways Cards",
  description: "Cards inside the 'More ways to build' banner.",
  page: { section: "More Ways", list: "cards" },
  fields: [
    { key: "order", columnId: "col-mwc-order", name: "Order", type: "number" },
    { key: "title", columnId: "col-mwc-title", name: "Title", type: "string" },
    { key: "description", columnId: "col-mwc-desc", name: "Description", type: "text" },
    { key: "linkText", columnId: "col-mwc-link-text", name: "Link Text", type: "string", aliases: ["Button Text"] },
    { key: "linkUrl", columnId: "col-mwc-link", name: "Link URL", type: "url", aliases: ["Link", "URL"] },
    { key: "active", columnId: "col-mwc-active", name: "Active", type: "string", defaultValue: "true" },
  ],
};

export interface CmsPartner {
  id: string;
  order: number;
  title: string;
  tag: string;
  description: string;
  imageUrl: string | null;
  actionText: string;
  actionUrl: string | null;
  footerText: string;
}

export interface MoreWays {
  heading: string;
  subheading: string;
  cards: { id: string; title: string; description: string; linkText: string; linkUrl: string | null }[];
}

/** Links shown to learners: https (or mailto) only. */
function safeLink(value: string | undefined): string | null {
  if (!value) return null;
  return /^(https?:\/\/|mailto:)/i.test(value) ? value : null;
}

function safeImage(value: string | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

const CACHE_TTL_MS = 60 * 1000;
let partnersCache: { expiresAt: number; value: CmsPartner[] | null } | null = null;
let moreWaysCache: { expiresAt: number; value: MoreWays | null } | null = null;

export class CmsDashboardService {
  /** Partner cards from the CMS, or `null` when the Partners section isn't set up. */
  static async getPartners(): Promise<CmsPartner[] | null> {
    if (partnersCache && partnersCache.expiresAt > Date.now()) return partnersCache.value;
    let value: CmsPartner[] | null = null;
    try {
      const rows = await readCmsTable(PARTNERS_LIST);
      value = rows
        ? rows
            .filter((r) => r.values.title && cmsBoolean(r.values.active, true))
            .map((r, i) => ({
              id: r.rowId,
              order: cmsNumber(r.values.order, i + 1),
              title: r.values.title,
              tag: r.values.tag ?? "",
              description: r.values.description ?? "",
              imageUrl: safeImage(r.values.image),
              actionText: r.values.actionText || "Visit partner site ↗",
              actionUrl: safeLink(r.values.actionUrl),
              footerText: r.values.footerText ?? "",
            }))
            .sort((a, b) => a.order - b.order)
        : null;
    } catch (err) {
      console.warn("⚠️ Could not load partners from SI3 CMS:", (err as Error).message);
      if (partnersCache) return partnersCache.value;
    }
    partnersCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }

  /** The "More ways to build" banner, or `null` when it isn't set up / has no cards. */
  static async getMoreWays(): Promise<MoreWays | null> {
    if (moreWaysCache && moreWaysCache.expiresAt > Date.now()) return moreWaysCache.value;
    let value: MoreWays | null = null;
    try {
      const [head, cards] = await Promise.all([readCmsTable(MORE_WAYS_SECTION), readCmsTable(MORE_WAYS_CARDS)]);
      const list = (cards ?? [])
        .filter((r) => r.values.title && cmsBoolean(r.values.active, true))
        .map((r, i) => ({
          id: r.rowId,
          order: cmsNumber(r.values.order, i + 1),
          title: r.values.title,
          description: r.values.description ?? "",
          linkText: r.values.linkText || "Learn more ↗",
          linkUrl: safeLink(r.values.linkUrl),
        }))
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...card }) => card);
      if (list.length > 0) {
        const h = head?.[0]?.values ?? {};
        value = {
          heading: h.heading || "More ways to build with Si Her DeFi",
          subheading: h.subheading ?? "",
          cards: list,
        };
      }
    } catch (err) {
      console.warn("⚠️ Could not load 'More ways' from SI3 CMS:", (err as Error).message);
      if (moreWaysCache) return moreWaysCache.value;
    }
    moreWaysCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}

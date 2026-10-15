import { Event } from "../models/event.model";
import { parseStart } from "./cms-modules.service";
import { CmsRecord, CmsTableDef, cmsBoolean, cmsNumber, readCmsTable } from "./cms-table.service";

/** Where "Join on LinkedIn" goes until the team pastes the event's own page. */
const LINKEDIN_PAGE = "https://www.linkedin.com/company/si3-ecosystem/";
/** A date with no start time is shown as "Time to be announced"; noon ET keeps it on the right day everywhere. */
const TBA_CLOCK = "12:00 PM ET";
const DEFAULT_DURATION_MINUTES = 60;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Start Time as the team writes it, e.g. "Dec 9 · 1–2 PM ET" or "11–12 PM ET":
 * drops a leading date ("Dec 9 ·") and splits a range into start and end
 * clocks. The start takes the end's AM/PM unless that would put it after the
 * end ("11–12 PM" → 11 AM). Anything else is passed through as the start.
 */
export function splitStartTime(value: string | undefined): { start?: string; end?: string } {
  const text = (value ?? "").split("·").pop()!.trim();
  const range = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*(?:[-–—]|to)\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*\(?([a-z]{1,4})?\)?$/i
  );
  if (!range) return { start: text || undefined };
  const [, sh, sm = "00", smer, eh, em = "00", emer, zone = ""] = range;
  const startMer = smer ?? (emer && Number(sh) % 12 > Number(eh) % 12 ? (/^p/i.test(emer) ? "AM" : "PM") : emer);
  const clock = (h: string, m: string, mer?: string) => `${h}:${m}${mer ? ` ${mer}` : ""}${zone ? ` ${zone}` : ""}`;
  return { start: clock(sh, sm, startMer), end: clock(eh, em, emer) };
}

/**
 * The event's button. Until registration opens it's a grayed-out "Save the
 * Date" that can't be clicked. Both can be set in the CMS (`cta_active`,
 * `cta_text`); left empty, the button is live only once the event has its own
 * link (not the placeholder company page).
 */
function eventCta(kind: string, linkIsPlaceholder: boolean, active?: string, text?: string) {
  const ctaActive = cmsBoolean(active, !linkIsPlaceholder);
  const fallback = ctaActive ? (kind === "linkedin-live" ? "Join on LinkedIn" : "Open event") : "Save the Date";
  return { ctaActive, ctaText: text?.trim() || fallback };
}

export interface CmsCohortEvent {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  date: string;
  endDate?: string;
  timeTba?: boolean;
  partnerName?: string;
  speakers?: Array<{ name: string; companyName?: string }>;
  link: string;
  linkIsPlaceholder?: boolean;
  /** false → the button is grayed out and can't be clicked (e.g. "Save the Date") */
  ctaActive: boolean;
  /** the button's label */
  ctaText: string;
}

/**
 * Cohort events that aren't modules (no quiz, no badge), e.g. LinkedIn Lives.
 * Managed in the SI3 CMS on the "Si Her DeFi (Base)" page → "Events" section →
 * `events` list, one item per event (same place and style as Modules).
 * The "Si Her DeFi Events" form table is still read if the page list isn't set up.
 */
export const EVENTS_TABLE: CmsTableDef = {
  slug: "si-her-defi-events",
  name: "Si Her DeFi Events",
  description: "Cohort events and LinkedIn Lives for the learner app.",
  page: {
    section: "Events",
    list: "events",
    // The title is the event's identity; an explicit Event ID wins if the team sets one
    itemId: (v, i) => v.id || `event-${slugify(v.title ?? "") || i + 1}`,
  },
  fields: [
    { key: "id", columnId: "col-event-id", name: "Event ID", type: "string" },
    { key: "kind", columnId: "col-event-kind", name: "Kind", type: "string", defaultValue: "linkedin-live" },
    { key: "title", columnId: "col-event-title", name: "Title", type: "string", required: true, aliases: ["Event Title", "Event Name"] },
    { key: "subtitle", columnId: "col-event-subtitle", name: "Subtitle", type: "string" },
    { key: "active", columnId: "col-event-active", name: "Active", type: "string", defaultValue: "true" },
    { key: "date", columnId: "col-event-date", name: "Date", type: "string", required: true, aliases: ["Event Date", "Session Date"] },
    { key: "startTime", columnId: "col-event-start", name: "Start Time", type: "string", aliases: ["Start Time (UTC)", "Time"] },
    { key: "durationMinutes", columnId: "col-event-duration", name: "Duration (minutes)", type: "number" },
    { key: "endDate", columnId: "col-event-end-date", name: "End Date", type: "string" },
    { key: "timeTba", columnId: "col-event-time-tba", name: "Time TBA", type: "string" },
    { key: "partnerName", columnId: "col-event-partner", name: "Partner Name", type: "string", aliases: ["Partner"] },
    { key: "link", columnId: "col-event-link", name: "Link", type: "url", aliases: ["LinkedIn Link", "Event Link"] },
    { key: "linkIsPlaceholder", columnId: "col-event-link-placeholder", name: "Link Is Placeholder", type: "string" },
    { key: "ctaActive", columnId: "col-event-cta-active", name: "CTA Active", type: "string", aliases: ["Button Active", "Registration Open"] },
    { key: "ctaText", columnId: "col-event-cta-text", name: "CTA Text", type: "string", aliases: ["Button Text", "CTA Label", "Button Label"] },
  ],
};

/** One CMS item → an event, or null when it's switched off or its date can't be read. */
export function fromCmsRecord(r: CmsRecord): CmsCohortEvent | null {
  const v = r.values;
  if (!v.title || !cmsBoolean(v.active, true)) return null;

  // No start time (or Time TBA ticked) → the date is shown with "Time to be announced".
  // A start time that can't be read ("TBA", "Noon ET") is treated the same way,
  // so a known date never hides the whole event.
  const clocks = splitStartTime(v.startTime);
  let timeTba = !clocks.start || cmsBoolean(v.timeTba, false);
  let start = parseStart(v.date, timeTba ? TBA_CLOCK : clocks.start);
  if (!start && !timeTba) {
    start = parseStart(v.date, TBA_CLOCK);
    if (start) {
      timeTba = true;
      console.warn(`⚠️ Event "${v.title}": couldn't read Start Time "${v.startTime}", showing "Time to be announced" (use e.g. "12:00 PM ET").`);
    }
  }
  if (!start) {
    console.warn(
      `⚠️ Event "${v.title}": couldn't read Date "${v.date ?? ""}" / Start Time "${v.startTime ?? ""}" (use e.g. 2026-11-18 and "12:00 PM ET").`
    );
    return null;
  }
  // an end date wins, then the end of a Start Time range ("1–2 PM ET"), then the duration
  const rangeEnd = !timeTba && clocks.end ? parseStart(v.date, clocks.end) : null;
  const explicitEnd = v.endDate ? new Date(v.endDate) : rangeEnd && rangeEnd > start ? rangeEnd : null;
  const end =
    explicitEnd && !Number.isNaN(explicitEnd.getTime())
      ? explicitEnd
      : new Date(start.getTime() + Math.max(cmsNumber(v.durationMinutes, DEFAULT_DURATION_MINUTES), 1) * 60 * 1000);

  const link = v.link?.trim() || LINKEDIN_PAGE;
  const kind = v.kind?.trim() || "linkedin-live";
  const linkIsPlaceholder = cmsBoolean(v.linkIsPlaceholder, link === LINKEDIN_PAGE);
  return {
    id: r.rowId,
    kind,
    title: v.title,
    subtitle: v.subtitle || undefined,
    date: start.toISOString(),
    endDate: timeTba ? undefined : end.toISOString(),
    timeTba,
    partnerName: v.partnerName || undefined,
    speakers: [],
    link,
    linkIsPlaceholder,
    ...eventCta(kind, linkIsPlaceholder, v.ctaActive, v.ctaText),
  };
}

export const SEED_EVENTS: CmsCohortEvent[] = [
  {
    id: "event-proof-of-adoption",
    kind: "linkedin-live",
    title: "Proof of Adoption",
    subtitle: "Driving Real-World Value for Crypto's Next Billion Users",
    date: "2026-11-18T17:00:00.000Z",
    timeTba: true,
    partnerName: "DeFi For Good",
    speakers: [],
    link: "https://www.linkedin.com/company/si3-ecosystem/",
    linkIsPlaceholder: true,
    ...eventCta("linkedin-live", true),
  },
  {
    id: "event-the-capital-table",
    kind: "linkedin-live",
    title: "The Capital Table",
    subtitle: "DeFi's Next Chapter",
    date: "2026-12-09T17:00:00.000Z",
    timeTba: true,
    partnerName: "",
    speakers: [],
    link: "https://www.linkedin.com/company/si3-ecosystem/",
    linkIsPlaceholder: true,
    ...eventCta("linkedin-live", true),
  },
];

/** CMS edits show up in the app within a minute; every request in between is served from memory. */
const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; events: CmsCohortEvent[] } | null = null;
let inFlight: Promise<CmsCohortEvent[]> | null = null;

export class CmsEventsService {
  static async getAllEvents(): Promise<CmsCohortEvent[]> {
    if (cache && cache.expiresAt > Date.now()) return cache.events;
    // Requests arriving together share one CMS read
    inFlight ??= this.loadEvents()
      .then((events) => {
        cache = { expiresAt: Date.now() + CACHE_TTL_MS, events };
        return events;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  private static async loadEvents(): Promise<CmsCohortEvent[]> {
    // 1. The CMS (Si Her DeFi (Base) page → Events). Once the list exists it is
    //    the only source — an empty list means no events, never the old seed.
    try {
      const records = await readCmsTable(EVENTS_TABLE);
      if (records !== null) {
        return records
          .map(fromCmsRecord)
          .filter((e): e is CmsCohortEvent => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch (err) {
      console.warn("⚠️ Could not read events from the CMS:", (err as Error).message);
    }

    // 2. Not set up in the CMS yet: the certificates database Event collection, auto-seeding if empty
    try {
      let dbEvents = await Event.find().sort({ date: 1 });
      if (dbEvents.length === 0) {
        for (const s of SEED_EVENTS) {
          await Event.create({
            id: s.id,
            kind: s.kind,
            title: s.title,
            subtitle: s.subtitle,
            date: new Date(s.date),
            timeTba: s.timeTba ?? true,
            partnerName: s.partnerName,
            link: s.link,
            linkIsPlaceholder: s.linkIsPlaceholder ?? true,
          });
        }
        dbEvents = await Event.find().sort({ date: 1 });
      }

      return dbEvents.map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        subtitle: doc.subtitle,
        date: doc.date.toISOString(),
        endDate: doc.endDate?.toISOString(),
        timeTba: doc.timeTba,
        partnerName: doc.partnerName,
        speakers: [],
        link: doc.link,
        linkIsPlaceholder: doc.linkIsPlaceholder,
        ...eventCta(doc.kind, doc.linkIsPlaceholder ?? true),
      }));
    } catch (err: any) {
      console.warn("⚠️ Could not read from Event DB collection:", err.message);
    }

    // 3. Fallback to SEED_EVENTS
    return SEED_EVENTS;
  }
}

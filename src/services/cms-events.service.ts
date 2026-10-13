import { Event } from "../models/event.model";
import { CmsTableDef, cmsBoolean, readCmsTable } from "./cms-table.service";

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
}

export const EVENTS_TABLE: CmsTableDef = {
  slug: "si-her-defi-events",
  name: "Si Her DeFi Events",
  description: "Cohort events and LinkedIn Lives for the learner app.",
  fields: [
    { key: "id", columnId: "col-event-id", name: "Event ID", type: "string" },
    { key: "kind", columnId: "col-event-kind", name: "Kind", type: "string", defaultValue: "linkedin-live" },
    { key: "title", columnId: "col-event-title", name: "Title", type: "string", required: true },
    { key: "subtitle", columnId: "col-event-subtitle", name: "Subtitle", type: "string" },
    { key: "date", columnId: "col-event-date", name: "Date", type: "string", required: true },
    { key: "endDate", columnId: "col-event-end-date", name: "End Date", type: "string" },
    { key: "timeTba", columnId: "col-event-time-tba", name: "Time TBA", type: "string", defaultValue: "true" },
    { key: "partnerName", columnId: "col-event-partner", name: "Partner Name", type: "string" },
    { key: "link", columnId: "col-event-link", name: "Link", type: "url", required: true },
    { key: "linkIsPlaceholder", columnId: "col-event-link-placeholder", name: "Link Is Placeholder", type: "string", defaultValue: "true" },
  ],
};

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
  },
];

export class CmsEventsService {
  static async getAllEvents(): Promise<CmsCohortEvent[]> {
    // 1. Try reading from SI3 CMS tables first
    try {
      const records = await readCmsTable(EVENTS_TABLE);
      if (records && records.length > 0) {
        return records
          .filter((r) => r.values.title)
          .map((r, i) => ({
            id: r.values.id || `event-${r.rowId || i}`,
            kind: r.values.kind || "linkedin-live",
            title: r.values.title,
            subtitle: r.values.subtitle || undefined,
            date: r.values.date || "2026-11-18T17:00:00.000Z",
            endDate: r.values.endDate || undefined,
            timeTba: cmsBoolean(r.values.timeTba, true),
            partnerName: r.values.partnerName || undefined,
            speakers: [],
            link: r.values.link || "https://www.linkedin.com/company/si3-ecosystem/",
            linkIsPlaceholder: cmsBoolean(r.values.linkIsPlaceholder, true),
          }));
      }
    } catch {
      // CMS table does not exist or error reading
    }

    // 2. Read from certificates database Event collection, auto-seeding if empty
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
      }));
    } catch (err: any) {
      console.warn("⚠️ Could not read from Event DB collection:", err.message);
    }

    // 3. Fallback to SEED_EVENTS
    return SEED_EVENTS;
  }
}

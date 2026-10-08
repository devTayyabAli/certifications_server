import mongoose from "mongoose";
import { env } from "../config/env";

export interface CmsSpeaker {
  id: string;
  name: string;
  email?: string;
  role: string;
  companyTag: string;
  companyName: string;
  headshotUrl?: string;
  additionalImageUrl?: string;
  companyLogoUrl?: string;
  bio?: string;
  programType?: string;
  sessionTitle?: string;
  sessionDescription?: string;
  sessionDate?: string;
  telegramHandle?: string;
  links: {
    website?: string;
    x?: string;
    linkedin?: string;
  };
}

const META_TTL_MS = 60 * 1000; // 1 minute cache
let cachedSpeakers: { speakers: CmsSpeaker[]; expiresAt: number } | null = null;

function cmsDb() {
  const conn = mongoose.connection as any;
  if (conn.client) {
    return conn.client.db(env.APPLICATIONS_DB_NAME);
  }
  return conn.useDb(env.APPLICATIONS_DB_NAME).db;
}

export class CmsSpeakerService {
  /**
   * Fetch all speakers directly from SI3 CMS (`si3_cms.si3tables` -> slug: "si3-speakers")
   */
  static async getAllSpeakers(): Promise<CmsSpeaker[]> {
    if (cachedSpeakers && cachedSpeakers.expiresAt > Date.now()) {
      return cachedSpeakers.speakers;
    }

    try {
      const db = cmsDb();
      const table = await db.collection("si3tables").findOne({ slug: "si3-speakers" });

      if (!table || !Array.isArray(table.rows)) {
        return [];
      }

      // Build column id -> property mapping
      const columns = Array.isArray(table.columns) ? table.columns : [];
      const colIdMap: Record<string, string> = {};

      for (const col of columns) {
        const rawName = (col.name || "").toLowerCase().trim();
        if (rawName === "name" || rawName.includes("full name")) {
          colIdMap[col.id] = "name";
        } else if (rawName.includes("email")) {
          colIdMap[col.id] = "email";
        } else if (
          rawName.includes("session title") ||
          rawName.includes("session_title") ||
          rawName.includes("project title")
        ) {
          colIdMap[col.id] = "sessionTitle";
        } else if (
          rawName === "your title" ||
          rawName.includes("your title") ||
          rawName === "role" ||
          rawName.includes("job title")
        ) {
          colIdMap[col.id] = "role";
        } else if (
          rawName.includes("company") ||
          rawName.includes("organization") ||
          rawName.includes("your_company")
        ) {
          if (rawName.includes("logo")) {
            colIdMap[col.id] = "companyLogo";
          } else {
            colIdMap[col.id] = "organization";
          }
        } else if (rawName.includes("headshot") || rawName.includes("profile_picture")) {
          colIdMap[col.id] = "headshot";
        } else if (rawName.includes("additional image")) {
          colIdMap[col.id] = "additionalImage";
        } else if (rawName.includes("bio")) {
          colIdMap[col.id] = "bio";
        } else if (rawName.includes("program")) {
          colIdMap[col.id] = "programType";
        } else if (rawName.includes("session description") || rawName.includes("session_description")) {
          colIdMap[col.id] = "sessionDescription";
        } else if (rawName.includes("session date") || rawName.includes("session_date")) {
          colIdMap[col.id] = "sessionDate";
        } else if (rawName.includes("telegram")) {
          colIdMap[col.id] = "telegram";
        }
      }

      // Explicit verified column IDs for SI3 CMS Speakers table
      const fallbackMappings: Record<string, string> = {
        "col-e4mjox": "name",
        "col-gfn3zk": "email",
        "col-uzx6ec": "role",
        "ua9a64": "organization",
        "col-3fgxi0": "headshot",
        "col-58fa35": "additionalImage",
        "col-66d5et": "companyLogo",
        "col-exww6a": "bio",
        "col-y6zm83": "programType",
        "col-ndwdau": "sessionTitle",
        "col-5elbuh": "sessionTitle",
        "col-fv897k": "sessionDate",
        "col-davfcr": "sessionDescription",
        "col-wbm1wq": "telegram",
      };

      const finalMap = { ...colIdMap, ...fallbackMappings };

      const speakers: CmsSpeaker[] = table.rows.map((row: any) => {
        const rawData = row.data || {};
        const extracted: Record<string, string> = {};

        for (const [colId, val] of Object.entries(rawData)) {
          const propName = finalMap[colId];
          if (propName && typeof val === "string") {
            extracted[propName] = val.trim();
          }
        }

        const org = extracted.organization || "Si Her DeFi";
        const companyTag = org.split(" ")[0].toUpperCase();


        return {
          id: row._id?.toString() || row.rowId || String(Math.random()),
          name: extracted.name || "Guest Speaker",
          email: extracted.email,
          role: extracted.role || "Web3 Expert",
          companyTag: companyTag.slice(0, 12),
          companyName: org,
          headshotUrl: extracted.headshot || undefined,
          additionalImageUrl: extracted.additionalImage || undefined,
          companyLogoUrl: extracted.companyLogo || undefined,
          bio: extracted.bio,
          programType: extracted.programType,
          sessionTitle: extracted.sessionTitle,
          sessionDescription: extracted.sessionDescription,
          sessionDate: extracted.sessionDate,
          // A Telegram handle is only a Telegram handle — it is not an X account
          telegramHandle: extracted.telegram || undefined,
          links: {},
        };
      });

      cachedSpeakers = {
        speakers,
        expiresAt: Date.now() + META_TTL_MS,
      };

      return speakers;
    } catch (err: any) {
      console.warn("⚠️ Could not load speakers from SI3 CMS:", err.message);
      return [];
    }
  }

  /**
   * Filter speakers strictly for the Si Her DeFi cohort:
   * Only matching "Si Her DeFi Education Cohort", excluding DAO Sessions and Grow3dge
   */
  static async getCohortSpeakers(): Promise<CmsSpeaker[]> {
    const all = await this.getAllSpeakers();
    return all.filter((s) => {
      const prog = (s.programType || "").toLowerCase().trim();
      return prog === "si her defi education cohort";
    });
  }
}

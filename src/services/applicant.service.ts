import mongoose from "mongoose";
import { env } from "../config/env";

export interface Applicant {
  email: string;
  name: string;
  role: string;
  organization: string;
  socialLink: string;
  telegram: string;
}

type Column = { id: string; name: string };

type TableMeta = {
  tableId: any;
  columnIdByName: Map<string, string>;
  tableDoc?: any;
};

const META_TTL_MS = 60 * 1000; // 1 minute cache
let cachedMeta: { value: TableMeta; expiresAt: number } | null = null;

function cmsDb() {
  const conn = mongoose.connection as any;
  if (conn.client) {
    return conn.client.db(env.APPLICATIONS_DB_NAME);
  }
  return conn.useDb(env.APPLICATIONS_DB_NAME).db;
}

function toObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

async function getTableMeta(): Promise<TableMeta> {
  if (cachedMeta && cachedMeta.expiresAt > Date.now()) return cachedMeta.value;

  const db = cmsDb();
  const form = await db
    .collection("forms")
    .findOne({ slug: env.APPLICATION_FORM_SLUG });

  if (!form || !form.tableId) {
    throw new Error(`Application form "${env.APPLICATION_FORM_SLUG}" or its table was not found`);
  }

  const rawTableId = form.tableId;
  const objId = toObjectId(rawTableId);
  const queryConditions: any[] = [{ _id: rawTableId }, { _id: String(rawTableId) }];
  if (objId) queryConditions.push({ _id: objId });

  const table = await db
    .collection("si3tables")
    .findOne({ $or: queryConditions });

  if (!table) {
    throw new Error(`Table with ID ${rawTableId} not found in si3tables`);
  }

  const columns = (table?.columns ?? []) as Column[];
  const columnIdByName = new Map<string, string>();
  for (const column of columns) {
    if (!columnIdByName.has(column.name)) columnIdByName.set(column.name, column.id);
  }

  const value = { tableId: rawTableId, columnIdByName };
  cachedMeta = { value, expiresAt: Date.now() + META_TTL_MS };
  return value;
}

export class ApplicantService {
  /**
   * Returns the applicant for `email`, or null if they never applied.
   */
  static async findByEmail(rawEmail: string): Promise<Applicant | null> {
    if (!rawEmail) return null;
    const email = rawEmail.trim().toLowerCase();

    try {
      const meta = await getTableMeta();
      const emailColumnId = meta.columnIdByName.get("email");
      if (!emailColumnId) {
        console.warn("⚠️ No 'email' column found in application table columns");
        return null;
      }

      const objId = toObjectId(meta.tableId);
      const queryConditions: any[] = [{ _id: meta.tableId }, { _id: String(meta.tableId) }];
      if (objId) queryConditions.push({ _id: objId });

      const table = await cmsDb()
        .collection("si3tables")
        .findOne({ $or: queryConditions }, { projection: { rows: 1 } });

      if (!table || !Array.isArray(table.rows)) {
        return null;
      }

      const matchingRow = table.rows.find((r: any) => {
        const val = r?.data?.[emailColumnId];
        return typeof val === "string" && val.trim().toLowerCase() === email;
      });

      if (!matchingRow || !matchingRow.data) {
        return null;
      }

      const data = matchingRow.data;
      const read = (...names: string[]) => {
        for (const name of names) {
          const id = meta.columnIdByName.get(name);
          const value = id ? data[id] : undefined;
          if (typeof value === "string" && value.trim() !== "") return value.trim();
        }
        return "";
      };

      return {
        email,
        name: read("your_name", "full_name"),
        role: read("professional_role"),
        organization: read("organization"),
        socialLink: read("please_share_your_linkedin_or_x_profile_link_linkedin_preferred"),
        telegram: read("telegram_handle"),
      };
    } catch (err) {
      console.error("❌ ApplicantService.findByEmail error:", err);
      return null;
    }
  }
}

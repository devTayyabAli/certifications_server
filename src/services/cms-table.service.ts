import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * Generic reader for SI3 CMS tables (`si3_cms.si3tables`).
 *
 * The CMS stores each table as `{ slug, columns: [{ id, name, type }], rows:
 * [{ rowId, data: { [columnId]: value } }] }` and the team edits it from the
 * CMS UI. A table definition here names the columns we expect; columns are
 * matched by id first and then by name, so renaming a column in the CMS or
 * re-creating the table by hand keeps working.
 */

export type CmsColumnType = "string" | "text" | "number" | "image" | "url";

export interface CmsFieldDef {
  /** Property name used in code */
  key: string;
  /** Column id used when the table is created by our setup script */
  columnId: string;
  /** Human column name shown in the CMS */
  name: string;
  type: CmsColumnType;
  required?: boolean;
  defaultValue?: string | number | null;
  /** Other column names that should map to this field */
  aliases?: string[];
}

/**
 * Where the content lives on the "Si Her DeFi (Base)" page (Certifications)
 * in the CMS. A page is made of sections; a section has plain fields and
 * list ("array") fields.
 */
export interface CmsPageSource {
  /** Section title on the page, e.g. "Onboarding" */
  section: string;
  /** Name of the list field for row-style content; omit for the section's own fields */
  list?: string;
  /** Stable id for a list item (list items have no id of their own) */
  itemId?: (values: Record<string, string>, index: number) => string;
}

export interface CmsTableDef {
  slug: string;
  name: string;
  description: string;
  fields: CmsFieldDef[];
  /** Preferred source: a section of the Si Her DeFi page. Falls back to the form table. */
  page?: CmsPageSource;
}

/** The cohort's page in the CMS — Certifications → "Si Her DeFi (Base)". */
export const SI_HER_DEFI_PAGE = { slug: "si-her-defi-placeholder", name: "Si Her DeFi (Base)" };

export interface CmsRecord {
  /** Stable id of the CMS row — survives edits to its content */
  rowId: string;
  values: Record<string, string>;
}

export function cmsDb() {
  const conn = mongoose.connection as unknown as {
    client?: { db: (name: string) => mongoose.mongo.Db };
    useDb: (name: string) => { db: mongoose.mongo.Db };
  };
  if (conn.client) return conn.client.db(env.APPLICATIONS_DB_NAME);
  return conn.useDb(env.APPLICATIONS_DB_NAME).db;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toText(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  // Checkbox / multi-select form fields store a list of choices
  if (Array.isArray(value)) {
    const parts = value.map(toText).filter((v): v is string => !!v);
    return parts.length > 0 ? parts.join(", ") : "";
  }
  return null;
}

/** A table every cohort deployment has — tells us which CMS project is ours. */
const REFERENCE_TABLE_SLUG = "si3-speakers";
let projectIdCache: { value: unknown; expiresAt: number } | null = null;

async function cohortProjectId(): Promise<unknown> {
  if (projectIdCache && projectIdCache.expiresAt > Date.now()) return projectIdCache.value;
  const reference = await cmsDb()
    .collection("si3tables")
    .findOne({ slug: REFERENCE_TABLE_SLUG }, { projection: { projectId: 1 } });
  projectIdCache = { value: reference?.projectId ?? null, expiresAt: Date.now() + 10 * 60 * 1000 };
  return projectIdCache.value;
}

/**
 * Finds the table by slug, or else by name. Tables made in the CMS UI come
 * from "+ New Form", and their slug doesn't always follow the form title, so
 * the name is the reliable handle. Limited to the cohort's CMS project so a
 * same-named table in a test project is never picked up.
 */
async function findTable(def: CmsTableDef) {
  const tables = cmsDb().collection("si3tables");
  const projectId = await cohortProjectId();
  const scope = projectId ? { projectId } : {};

  const bySlug = await tables.findOne({ ...scope, slug: def.slug }, { sort: { updatedAt: -1 } });
  if (bySlug) return bySlug;

  const wanted = normalizeName(def.name);
  const candidates = await tables
    .find({ ...scope, section: "tables" }, { projection: { name: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  const match = candidates.find((t) => normalizeName(String(t.name ?? "")) === wanted);
  return match ? tables.findOne({ _id: match._id }) : null;
}

/** Maps a raw `{ name: value }` object onto the definition's field keys. */
function mapByName(raw: Record<string, unknown>, def: CmsTableDef) {
  const lookup = new Map<string, string>();
  for (const field of def.fields) {
    for (const name of [field.name, field.key, ...(field.aliases ?? [])]) lookup.set(normalizeName(name), field.key);
  }
  const values: Record<string, string> = {};
  for (const [name, raw_] of Object.entries(raw ?? {})) {
    const key = lookup.get(normalizeName(name));
    const text = toText(raw_);
    if (!key || text === null) continue;
    // Two fields can feed one value (e.g. an upload field and a link field);
    // an empty one never wipes out a filled one
    if (text === "" && values[key]) continue;
    values[key] = text;
  }
  return values;
}

interface PageNode {
  name?: string;
  label?: string;
  fields?: { name?: string; label?: string; type?: string }[];
  data?: Record<string, unknown>;
}

/**
 * Reads the definition's content from the Si Her DeFi page. Returns `null`
 * when the page or section isn't set up, so the caller can fall back.
 */
async function readPageRecords(def: CmsTableDef): Promise<CmsRecord[] | null> {
  if (!def.page) return null;
  const db = cmsDb();
  const projectId = await cohortProjectId();
  const scope = projectId ? { projectId } : {};

  const schemas = await db
    .collection("schemas")
    .find(scope, { projection: { name: 1, slug: 1 } })
    .toArray();
  const page =
    schemas.find((s) => s.slug === SI_HER_DEFI_PAGE.slug) ??
    schemas.find((s) => normalizeName(String(s.name ?? "")) === normalizeName(SI_HER_DEFI_PAGE.name));
  if (!page) return null;

  const wanted = normalizeName(def.page.section);
  const isNamed = (d: Record<string, unknown> & { data?: { tree?: PageNode } }) =>
    [d.title, d.label, d.data?.tree?.name, d.data?.tree?.label].some(
      (n) => typeof n === "string" && normalizeName(n) === wanted
    );
  // Unpublished sections are drafts — ignored until the team publishes them
  const sections = (await db.collection("documents").find({ schemaId: page._id }).toArray())
    .filter((d) => d.published !== false)
    // The named section first, then the rest of the page
    .sort((a, b) => Number(isNamed(b)) - Number(isNamed(a)));

  if (!def.page.list) {
    const section = sections.find(isNamed);
    if (!section) return null;
    return [{ rowId: `${wanted}`, values: mapByName(section.data?.tree?.data ?? {}, def) }];
  }

  // A list can sit in its named section or in a section of its own
  const listName = normalizeName(def.page.list);
  let tree: PageNode | null = null;
  let listField: NonNullable<PageNode["fields"]>[number] | undefined;
  for (const section of sections) {
    const candidate: PageNode = section.data?.tree ?? {};
    listField = (candidate.fields ?? []).find(
      (f) => f.type === "array" && [f.name, f.label].some((n) => n && normalizeName(n) === listName)
    );
    if (listField?.name) {
      tree = candidate;
      break;
    }
  }
  // No such list on the page yet → not set up here (fall back to the form)
  if (!tree || !listField?.name) return null;
  const items = (tree.data ?? {})[listField.name];
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const values = mapByName((item ?? {}) as Record<string, unknown>, def);
    return {
      rowId: def.page?.itemId ? def.page.itemId(values, index) : `${wanted}-${listName}-${index + 1}`,
      values,
    };
  });
}

/** Which CMS source a definition is read from right now — for the check scripts. */
export async function cmsSourceOf(def: CmsTableDef): Promise<"page" | "form" | null> {
  if ((await readPageRecords(def)) !== null) return "page";
  return (await findTable(def)) ? "form" : null;
}

/**
 * Reads every row of a CMS definition: from its section on the Si Her DeFi
 * page when that is set up, otherwise from its form table. Returns `null`
 * when neither exists, so callers can tell "not set up" apart from "empty".
 */
export async function readCmsTable(def: CmsTableDef): Promise<CmsRecord[] | null> {
  const fromPage = await readPageRecords(def);
  if (fromPage !== null) return fromPage;

  const table = await findTable(def);

  if (!table) return null;

  const columns: { id?: string; name?: string }[] = Array.isArray(table.columns) ? table.columns : [];
  const columnToKey: Record<string, string> = {};

  for (const field of def.fields) {
    const names = [field.name, ...(field.aliases ?? [])].map(normalizeName);
    const byId = columns.find((c) => c.id === field.columnId);
    const byName = columns.find((c) => c.name && names.includes(normalizeName(c.name)));
    const match = byId ?? byName;
    if (match?.id) columnToKey[match.id] = field.key;
  }

  const rows: { rowId?: string; _id?: unknown; data?: Record<string, unknown> }[] = Array.isArray(
    table.rows
  )
    ? table.rows
    : [];

  return rows.map((row, index) => {
    const values: Record<string, string> = {};
    for (const [columnId, raw] of Object.entries(row.data ?? {})) {
      const key = columnToKey[columnId];
      const text = toText(raw);
      if (key && text !== null) values[key] = text;
    }
    return {
      rowId: row.rowId || (row._id ? String(row._id) : `${def.slug}-${index}`),
      values,
    };
  });
}

/** CMS checkbox-style values are stored as text ("true", "Yes", "1"). */
export function cmsBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["true", "yes", "y", "1", "on"].includes(value.toLowerCase());
}

export function cmsNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

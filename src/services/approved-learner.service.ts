import { env } from "../config/env";
import { cmsDb } from "./cms-table.service";

/**
 * Who may sign in: learners on the cohort's approved lists in the SI3 CMS CRM
 * (Members table → "Lists" column, e.g. "Si Her DeFi Approved"). The team
 * approves or denies applicants there, so this follows their decision
 * directly — applying alone is not enough, and denied applicants stay out.
 */

/** A table every cohort deployment has — tells us which CMS project is ours. */
const REFERENCE_TABLE_SLUG = "si3-speakers";
const CACHE_TTL_MS = 60 * 1000;

interface MemberRecord {
  name: string;
  lists: string[];
}

let cache: { expiresAt: number; byEmail: Map<string, MemberRecord> } | null = null;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function loadMembers(): Promise<Map<string, MemberRecord>> {
  const db = cmsDb();
  const reference = await db
    .collection("si3tables")
    .findOne({ slug: REFERENCE_TABLE_SLUG }, { projection: { projectId: 1 } });
  const table = await db
    .collection("si3tables")
    .findOne(
      { slug: "members", section: "crm", ...(reference?.projectId ? { projectId: reference.projectId } : {}) },
      { projection: { columns: 1, rows: 1 } }
    );
  const byEmail = new Map<string, MemberRecord>();
  if (!table) return byEmail;

  const columns: { id: string; name?: string }[] = table.columns ?? [];
  const idOf = (name: string) => columns.find((c) => normalize(c.name ?? "") === normalize(name))?.id;
  const emailId = idOf("Email") ?? "col-email";
  const listsId = idOf("Lists") ?? "col-lists";
  const nameId = idOf("Name") ?? "col-name";

  for (const row of (table.rows ?? []) as { data?: Record<string, unknown> }[]) {
    const email = String(row.data?.[emailId] ?? "").trim().toLowerCase();
    if (!email) continue;
    const rawLists = row.data?.[listsId];
    const lists = (Array.isArray(rawLists) ? rawLists : String(rawLists ?? "").split(","))
      .map((l) => String(l).trim())
      .filter(Boolean);
    const existing = byEmail.get(email);
    // The same person can appear twice; keep every list they're on
    byEmail.set(email, {
      name: existing?.name || String(row.data?.[nameId] ?? "").trim(),
      lists: [...new Set([...(existing?.lists ?? []), ...lists])],
    });
  }
  return byEmail;
}

export class ApprovedLearnerService {
  /**
   * The CRM record for an approved learner, or null when the email isn't on
   * an approved list (or is on a denied one).
   */
  static async findApproved(rawEmail: string): Promise<MemberRecord | null> {
    const email = rawEmail.trim().toLowerCase();
    if (!cache || cache.expiresAt <= Date.now()) {
      try {
        cache = { expiresAt: Date.now() + CACHE_TTL_MS, byEmail: await loadMembers() };
      } catch (err) {
        console.error("❌ Could not read the approved list from the SI3 CMS:", (err as Error).message);
        if (!cache) return null;
      }
    }

    const member = cache.byEmail.get(email);
    if (!member) return null;
    const lists = member.lists.map(normalize);
    if (env.deniedLists.some((l) => lists.includes(normalize(l)))) return null;
    return env.approvedLists.some((l) => lists.includes(normalize(l))) ? member : null;
  }
}

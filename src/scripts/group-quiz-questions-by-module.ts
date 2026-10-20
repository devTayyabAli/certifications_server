/**
 * Puts each module's quiz questions under that module in the CMS.
 *
 * "Si Her DeFi (Base)" → "Modules" becomes "Modules & Quizzes". Inside it, one
 * sub-section per module (named after the module) holds that module's
 * quiz_questions rows, with the same fields as before (minus Week and Order:
 * the sub-section says which module, and the row order says which comes
 * first). The separate top-level "quiz_questions" section is unpublished once
 * its rows have moved, and the unused Quiz text box is removed from the module
 * fields. The app reads the new layout, so learners see the same quizzes.
 *
 * Deploy the server that reads "Modules & Quizzes" (cms-modules.service with
 * MODULES_SECTION_ALIASES) before applying: an older server wouldn't find the
 * renamed section's quizzes.
 *
 * The app's MONGODB_URI is read-only on the CMS; set CMS_WRITE_MONGODB_URI
 * (a user that can update si3_cms.documents) for the --apply run.
 *
 *   npm run cms:quizzes:group                      # dry run: prints the plan
 *   npm run cms:quizzes:group -- --apply           # moves the rows (saves a backup first)
 *   npm run cms:quizzes:group -- --restore <file>  # puts a backup back
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { cmsDb, SI_HER_DEFI_PAGE } from "../services/cms-table.service";
import { slugify } from "../services/cms-modules.service";

const SECTION_NAME = "Modules & Quizzes";
const LIST_NAME = "quiz_questions";
/** Dropped from the moved rows: the sub-section is the module, the row's place is its order */
const DROPPED_ROW_FIELDS = new Set(["week", "order"]);
/** The one-box quiz on each module, which the team asked not to use */
const DROPPED_MODULE_FIELDS = new Set(["quiz"]);

interface Field {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  subFields?: Field[];
  [k: string]: unknown;
}
interface TreeNode {
  id?: string;
  _key?: string;
  name?: string;
  label?: string;
  fields?: Field[];
  data?: Record<string, unknown>;
  children?: TreeNode[];
  [k: string]: unknown;
}
interface SectionDoc {
  _id: mongoose.Types.ObjectId;
  title?: string;
  published?: boolean;
  updatedAt?: Date;
  data: { tree: TreeNode };
}

const randomId = () => Math.random().toString(36).slice(2, 8);
const titleOf = (d: SectionDoc) => String(d.title || d.data?.tree?.name || d.data?.tree?.label || "").trim();
const plain = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const weekOf = (v: unknown) => {
  const n = Number(String(v ?? "").match(/\d+/)?.[0]);
  return Number.isInteger(n) ? n : NaN;
};

export interface Plan {
  modulesTree: TreeNode;
  perModule: { week: number; title: string; rows: Record<string, unknown>[] }[];
  unassigned: Record<string, unknown>[];
}

/** The modules section with a quiz sub-section per module; `null` when it is already like that. */
export function groupQuizQuestions(modulesTree: TreeNode, quizTree: TreeNode): Plan | null {
  const modulesField = (modulesTree.fields ?? []).find((f) => f.type === "array" && f.name === "modules");
  const quizField = (quizTree.fields ?? []).find((f) => f.type === "array" && f.name === LIST_NAME);
  if (!modulesField) throw new Error('The Modules section has no "modules" list.');
  if (!quizField) throw new Error(`The quiz section has no "${LIST_NAME}" list.`);

  const items = ((modulesTree.data ?? {}).modules ?? []) as Record<string, unknown>[];
  const rows = ((quizTree.data ?? {})[LIST_NAME] ?? []) as Record<string, unknown>[];
  const modules = items
    .map((m) => ({ week: weekOf(m.week), title: String(m.title ?? "").trim() }))
    .filter((m) => Number.isInteger(m.week) && m.title)
    .sort((a, b) => a.week - b.week);

  const existing = new Set((modulesTree.children ?? []).map((c) => plain(c.label || c.name)));
  if (modules.every((m) => existing.has(plain(m.title)))) return null;

  const byWeek = new Map<number, Record<string, unknown>[]>();
  const unassigned: Record<string, unknown>[] = [];
  for (const row of rows) {
    const week = weekOf(row.week);
    const target = Number.isInteger(week) && modules.some((m) => m.week === week) ? week : null;
    if (target === null) unassigned.push(row);
    else byWeek.set(target, [...(byWeek.get(target) ?? []), row]);
  }
  for (const list of byWeek.values()) {
    list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  const rowField: Field = {
    ...quizField,
    id: randomId(),
    subFields: (quizField.subFields ?? []).filter((f) => !DROPPED_ROW_FIELDS.has(String(f.name))),
  };
  const stripRow = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).filter(([k]) => !DROPPED_ROW_FIELDS.has(k)));

  const perModule = modules.map((m) => ({ ...m, rows: (byWeek.get(m.week) ?? []).map(stripRow) }));
  const children: TreeNode[] = [
    ...(modulesTree.children ?? []),
    ...perModule
      .filter((m) => !existing.has(plain(m.title)))
      .map((m) => ({
        id: randomId(),
        _key: `quiz_${slugify(m.title).replace(/-/g, "_")}`,
        name: m.title,
        label: m.title,
        children: [],
        fields: [{ ...rowField, id: randomId() }],
        data: { [LIST_NAME]: m.rows },
      })),
  ];

  const modulesTreeNext: TreeNode = {
    ...modulesTree,
    name: SECTION_NAME,
    label: SECTION_NAME,
    fields: (modulesTree.fields ?? []).map((f) =>
      f === modulesField
        ? { ...f, subFields: (f.subFields ?? []).filter((s) => !DROPPED_MODULE_FIELDS.has(String(s.name))) }
        : f
    ),
    data: {
      ...(modulesTree.data ?? {}),
      modules: items.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !DROPPED_MODULE_FIELDS.has(k)))),
    },
    children,
  };
  return { modulesTree: modulesTreeNext, perModule, unassigned };
}

async function pageSections(): Promise<SectionDoc[]> {
  const db = cmsDb();
  const reference = await db.collection("si3tables").findOne({ slug: "si3-speakers" }, { projection: { projectId: 1 } });
  const page = await db
    .collection("schemas")
    .findOne({ ...(reference?.projectId ? { projectId: reference.projectId } : {}), slug: SI_HER_DEFI_PAGE.slug });
  if (!page) throw new Error(`CMS page "${SI_HER_DEFI_PAGE.name}" not found`);
  return (await db.collection("documents").find({ schemaId: page._id }).toArray()) as unknown as SectionDoc[];
}

async function main() {
  const uri = process.env.CMS_WRITE_MONGODB_URI || env.MONGODB_URI;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const documents = cmsDb().collection("documents");
  const args = process.argv.slice(2);

  const restoreAt = args.indexOf("--restore");
  if (restoreAt >= 0) {
    const file = args[restoreAt + 1];
    if (!file) throw new Error("Usage: --restore <backup file>");
    const backup = JSON.parse(fs.readFileSync(file, "utf8")) as { modules: SectionDoc; quiz: SectionDoc };
    for (const doc of [backup.modules, backup.quiz]) {
      const result = await documents.updateOne(
        { _id: new mongoose.Types.ObjectId(String(doc._id)) },
        { $set: { title: doc.title, published: doc.published ?? true, "data.tree": doc.data.tree, updatedAt: new Date() } }
      );
      console.log(result.matchedCount ? `✅ Restored "${titleOf(doc)}"` : `❌ Section "${titleOf(doc)}" not found`);
    }
    return;
  }

  const sections = await pageSections();
  const modulesDoc = sections.find((d) => ["modules", plain(SECTION_NAME)].includes(plain(titleOf(d))));
  const quizDoc = sections.find((d) => plain(titleOf(d)) === plain(LIST_NAME));
  if (!modulesDoc) throw new Error('CMS section "Modules" not found');
  if (!quizDoc) throw new Error(`CMS section "${LIST_NAME}" not found`);

  const plan = groupQuizQuestions(modulesDoc.data.tree, quizDoc.data.tree);
  if (!plan) {
    console.log(`ℹ️ Nothing to do: every module already has its quiz sub-section in "${titleOf(modulesDoc)}".`);
    return;
  }

  console.log(`"${titleOf(modulesDoc)}" → "${SECTION_NAME}"`);
  for (const m of plan.perModule) {
    console.log(`  ${m.title}: ${m.rows.length} question(s)`);
  }
  if (plan.unassigned.length > 0) {
    console.log(`\n❌ ${plan.unassigned.length} question(s) have a Week that matches no module — fix them first:`);
    for (const r of plan.unassigned) console.log(`   week "${r.week}": ${String(r.question ?? "").slice(0, 60)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nThe "${LIST_NAME}" section is unpublished afterwards (its rows live under each module).`);
  console.log("The Quiz text box is removed from the module fields.");

  if (!args.includes("--apply")) {
    console.log("\nDry run — nothing changed. Deploy the server first, then add --apply to move the rows.");
    return;
  }

  const backupFile = path.join(os.tmpdir(), `cms-quizzes-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ modules: modulesDoc, quiz: quizDoc }, null, 2));
  console.log(`\nBackup saved: ${backupFile}`);

  // Only if nobody saved the section since it was read
  const moved = await documents.updateOne(
    { _id: modulesDoc._id, updatedAt: modulesDoc.updatedAt },
    { $set: { title: SECTION_NAME, "data.tree": plan.modulesTree, updatedAt: new Date() } }
  );
  if (moved.modifiedCount !== 1) {
    console.log("❌ The Modules section changed while this ran (someone saved it in the CMS). Nothing was written; run it again.");
    return;
  }
  const retired = await documents.updateOne(
    { _id: quizDoc._id },
    { $set: { published: false, title: `${LIST_NAME} (moved into ${SECTION_NAME})`, updatedAt: new Date() } }
  );
  console.log(
    retired.modifiedCount === 1
      ? `✅ Moved. To undo: npm run cms:quizzes:group -- --restore "${backupFile}"`
      : `⚠️ Rows moved, but the old "${LIST_NAME}" section could not be unpublished — unpublish it in the CMS. To undo: npm run cms:quizzes:group -- --restore "${backupFile}"`
  );
}

if (require.main === module) {
  main()
    .catch((err) => {
      const message: string = err?.message ?? String(err);
      console.error("❌", message);
      if (/not allowed|not authorized|Unauthorized/i.test(message)) {
        console.error("   The CMS user is read-only. Set CMS_WRITE_MONGODB_URI in Server/.env to a user that can update si3_cms.documents.");
      }
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

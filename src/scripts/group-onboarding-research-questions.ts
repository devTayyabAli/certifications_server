/**
 * Groups the onboarding research-question fields of the "Si Her DeFi (Base)"
 * page → "Onboarding" section into their own "Research Questions" sub-section,
 * so the team can find them in the CMS. The app reads sub-sections too, so it
 * sees exactly the same content before and after.
 *
 * Deploy the server that reads sub-sections (cms-table.service) before
 * applying: an older server would lose the questions.
 *
 *   npm run cms:onboarding:group                      # dry run: prints the plan
 *   npm run cms:onboarding:group -- --apply           # moves the fields (saves a backup first)
 *   npm run cms:onboarding:group -- --restore <file>  # puts a backup back
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

const SUBSECTION_KEY = "research_questions";
const SUBSECTION_NAME = "Research Questions";
/** In the order they appear on the onboarding page */
export const RESEARCH_FIELDS = [
  "questions_task_label",
  "questions_time_minutes",
  "task_note",
  "questions_header",
  "questions_intro",
  "questions",
];

interface Field {
  id?: string;
  name?: string;
  [k: string]: unknown;
}
export interface TreeNode {
  id?: string;
  _key?: string;
  name?: string;
  label?: string;
  fields?: Field[];
  data?: Record<string, unknown>;
  children?: TreeNode[];
  [k: string]: unknown;
}

const randomId = () => Math.random().toString(36).slice(2, 8);

/** The section with the research fields moved into a sub-section; `null` when there's nothing to move. */
export function groupResearchQuestions(tree: TreeNode): TreeNode | null {
  if ((tree.children ?? []).some((c) => c._key === SUBSECTION_KEY)) return null;
  const moved = RESEARCH_FIELDS.map((name) => (tree.fields ?? []).find((f) => f.name === name)).filter(
    (f): f is Field => !!f
  );
  if (moved.length === 0) return null;

  const names = new Set(moved.map((f) => f.name));
  const data = tree.data ?? {};
  return {
    ...tree,
    fields: (tree.fields ?? []).filter((f) => !names.has(f.name)),
    data: Object.fromEntries(Object.entries(data).filter(([k]) => !names.has(k))),
    children: [
      ...(tree.children ?? []),
      {
        id: randomId(),
        _key: SUBSECTION_KEY,
        name: SUBSECTION_NAME,
        label: SUBSECTION_NAME,
        children: [],
        fields: moved,
        data: Object.fromEntries(moved.filter((f) => f.name! in data).map((f) => [f.name!, data[f.name!]])),
      },
    ],
  };
}

async function onboardingSection() {
  const db = cmsDb();
  const reference = await db.collection("si3tables").findOne({ slug: "si3-speakers" }, { projection: { projectId: 1 } });
  const page = await db
    .collection("schemas")
    .findOne({ ...(reference?.projectId ? { projectId: reference.projectId } : {}), slug: SI_HER_DEFI_PAGE.slug });
  if (!page) throw new Error(`CMS page "${SI_HER_DEFI_PAGE.name}" not found`);
  const docs = await db.collection("documents").find({ schemaId: page._id }).toArray();
  const doc = docs.find((d) => [d.title, d.data?.tree?.name].some((n) => String(n ?? "").trim().toLowerCase() === "onboarding"));
  if (!doc) throw new Error('CMS section "Onboarding" not found');
  return doc;
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const documents = cmsDb().collection("documents");
  const args = process.argv.slice(2);

  const restoreAt = args.indexOf("--restore");
  if (restoreAt >= 0) {
    const file = args[restoreAt + 1];
    if (!file) throw new Error("Usage: --restore <backup file>");
    const backup = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = await documents.updateOne(
      { _id: new mongoose.Types.ObjectId(String(backup._id)) },
      { $set: { "data.tree": backup.data.tree, updatedAt: new Date() } }
    );
    console.log(result.matchedCount ? `✅ Restored the Onboarding section from ${file}` : "❌ Section not found");
    return;
  }

  const doc = await onboardingSection();
  const grouped = groupResearchQuestions(doc.data.tree);
  if (!grouped) {
    console.log(`ℹ️ Nothing to do: the "${SUBSECTION_NAME}" sub-section already exists, or none of its fields are in Onboarding.`);
    return;
  }
  const sub = grouped.children!.find((c) => c._key === SUBSECTION_KEY)!;
  console.log(`Onboarding → new sub-section "${SUBSECTION_NAME}" with: ${sub.fields!.map((f) => f.name).join(", ")}`);
  console.log(`Staying in Onboarding: ${grouped.fields!.map((f) => f.name).join(", ")}`);

  if (!args.includes("--apply")) {
    console.log("\nDry run — nothing changed. Add --apply to move the fields.");
    return;
  }

  const backupFile = path.join(os.tmpdir(), `cms-onboarding-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(doc, null, 2));
  console.log(`\nBackup saved: ${backupFile}`);

  // Only if nobody saved the section since it was read
  const result = await documents.updateOne(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: { "data.tree": grouped, updatedAt: new Date() } }
  );
  if (result.modifiedCount === 1) {
    console.log(`✅ Moved. To undo: npm run cms:onboarding:group -- --restore "${backupFile}"`);
  } else {
    console.log("❌ The section changed while this ran (someone saved it in the CMS). Nothing was written; run it again.");
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("❌", err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

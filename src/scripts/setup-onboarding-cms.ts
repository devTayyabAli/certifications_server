/**
 * Creates the Si Her Onboard tables in the SI3 CMS so the team can manage the
 * onboarding content (Kara's intro, questions, socials) from the CMS UI.
 *
 *   npm run cms:onboarding            # dry run — shows what would change
 *   npm run cms:onboarding -- --apply # writes to the CMS
 *
 * Writing needs a MongoDB user allowed to insert into si3_cms. If the app's
 * MONGODB_URI is read-only there, set CMS_WRITE_MONGODB_URI for this run.
 *
 * Safe to re-run: existing tables are never overwritten. A table that already
 * exists only gets any missing columns added; its rows are left untouched.
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import {
  ONBOARDING_QUESTIONS_TABLE,
  ONBOARDING_SOCIALS_TABLE,
  ONBOARDING_TABLE,
} from "../services/cms-onboarding.service";
import { CmsTableDef } from "../services/cms-table.service";

/** Existing cohort table — new tables go into the same CMS project and section. */
const REFERENCE_TABLE_SLUG = "si-her-defi-sessions";

type SeedRow = Record<string, string | number>;

// Starting content — the copy already shown in the app. The team edits it in the CMS.
const SEED_ROWS: Record<string, SeedRow[]> = {
  [ONBOARDING_TABLE.slug]: [
    {
      part: "Part 1",
      active: "true",
      stepLabel: "STEP 1 OF 2 · PART 1",
      cardTitle: "Si Her Onboard · Part 1",
      cardDescription:
        "As we kickoff Si Her DeFi, Si Her DAO seeks your insights to improve the experience. Engage with our social channels to amplify progress.",
      cardImage: "/SiHer_Onboard_Part 1.png",
      pageTitle: "Before we start, a word from Kara",
      pageSubtitle:
        "A quick video on what Si Her Study is, why we’re asking, and how your answers are used.",
      // Left empty on purpose: the team adds the link to Kara's recorded intro
      videoUrl: "",
      videoPoster: "/SiHer_Onboard_Part 1.png",
      videoCaption: "KARA HOWARD · SI HER DEFI INTRO",
      videoMinutes: 2,
      questionsMinutes: 5,
      videoTaskLabel: "Watch Kara’s intro",
      socialsHeading: "Follow Si<3>",
      socialsTaskLabel: "Follow Si<3> on X and LinkedIn",
      questionsTaskLabel: "Answer a short set of questions",
      taskNote: "No badge for this step — your answers feed an external research report.",
      questionsHeader: "SI HER STUDY · ENTRY",
      questionsIntro: "There are no right answers — we’re just exploring where you’re starting from today.",
      completionTitle: "Part 1 done",
      completionMessage:
        "Thanks for sharing where you’re starting from. Part 2 unlocks at the end of the cohort — same questions, plus a few about your experience.",
      nextStepNote: "Part 2: Si Her Onboard — locked until Week 12",
      dashboardDoneMessage: "Part 2 opens after the final module.",
    },
  ],
  [ONBOARDING_QUESTIONS_TABLE.slug]: [
    {
      part: "Part 1",
      order: 1,
      question: "In your own words, where are you with DeFi right now?",
      placeholder: "Write as much or as little as you like — a sentence is fine.",
      hint: "Your answer is stored with your response to the tenth question at the end.",
      maxLength: 400,
      required: "true",
      active: "true",
    },
    {
      part: "Part 1",
      order: 2,
      question: "What is the biggest barrier you encounter in Web3?",
      placeholder: "Share any technical, educational, or UX barriers you face...",
      hint: "Your answer is stored with your response to the tenth question at the end.",
      maxLength: 400,
      required: "true",
      active: "true",
    },
    {
      part: "Part 1",
      order: 3,
      question: "What goal do you hope to achieve by the end of this cohort?",
      placeholder: "e.g. Build an on-chain prototype, understand stablecoins, network...",
      hint: "Your answer is stored with your response to the tenth question at the end.",
      maxLength: 400,
      required: "true",
      active: "true",
    },
  ],
  [ONBOARDING_SOCIALS_TABLE.slug]: [
    {
      part: "Part 1",
      order: 1,
      platform: "x",
      label: "Si Her DeFi on X",
      handle: "@si3dao",
      url: "https://x.com/si3dao",
      required: "true",
      active: "true",
    },
    {
      part: "Part 1",
      order: 2,
      platform: "linkedin",
      label: "Si Her DeFi on LinkedIn",
      handle: "Si<3> company page",
      url: "https://www.linkedin.com/company/si3-dao",
      required: "true",
      active: "true",
    },
  ],
};

function columnDocs(def: CmsTableDef) {
  return def.fields.map((field) => ({
    id: field.columnId,
    name: field.name,
    type: field.type,
    required: !!field.required,
    defaultValue: field.defaultValue ?? null,
    _id: new Types.ObjectId(),
  }));
}

function rowDocs(def: CmsTableDef, seeds: SeedRow[], now: Date) {
  const stamp = now.getTime();
  return seeds.map((seed, index) => {
    const data: Record<string, string | number> = {};
    for (const field of def.fields) {
      if (seed[field.key] !== undefined) data[field.columnId] = seed[field.key];
    }
    return {
      rowId: `row-${stamp}-${index + 1}`,
      data,
      createdAt: now,
      updatedAt: now,
      _id: new Types.ObjectId(),
    };
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  // The app's own DB user usually has read-only access to the CMS. Pass a
  // connection string with write access for this one-off setup instead.
  const uri = process.env.CMS_WRITE_MONGODB_URI || env.MONGODB_URI;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.useDb(env.APPLICATIONS_DB_NAME).db!;
  const tables = db.collection("si3tables");

  const reference = await tables.findOne({ slug: REFERENCE_TABLE_SLUG });
  if (!reference?.projectId) {
    throw new Error(
      `Reference table "${REFERENCE_TABLE_SLUG}" not found in ${env.APPLICATIONS_DB_NAME} — can't tell which CMS project to use.`
    );
  }
  console.log(`CMS project: ${reference.projectId} · section: ${reference.section ?? "tables"}`);
  console.log(apply ? "Mode: APPLY (writing to the CMS)\n" : "Mode: dry run (nothing is written — pass --apply)\n");

  for (const def of [ONBOARDING_TABLE, ONBOARDING_QUESTIONS_TABLE, ONBOARDING_SOCIALS_TABLE]) {
    const existing = await tables.findOne({ slug: def.slug });

    if (existing) {
      const haveIds = new Set((existing.columns ?? []).map((c: { id: string }) => c.id));
      const haveNames = new Set(
        (existing.columns ?? []).map((c: { name: string }) => (c.name ?? "").toLowerCase())
      );
      const missing = columnDocs(def).filter(
        (c) => !haveIds.has(c.id) && !haveNames.has(c.name.toLowerCase())
      );
      if (missing.length === 0) {
        console.log(`✓ "${def.name}" already set up — left as is.`);
        continue;
      }
      console.log(`+ "${def.name}" exists — adding ${missing.length} missing column(s): ${missing.map((c) => c.name).join(", ")}`);
      if (apply) {
        await tables.updateOne(
          { _id: existing._id },
          { $push: { columns: { $each: missing } } as never, $set: { updatedAt: new Date() } }
        );
      }
      continue;
    }

    const now = new Date();
    const rows = rowDocs(def, SEED_ROWS[def.slug] ?? [], now);
    console.log(`+ Creating "${def.name}" (${def.slug}) with ${def.fields.length} columns and ${rows.length} starter row(s).`);
    if (apply) {
      await tables.insertOne({
        projectId: reference.projectId,
        name: def.name,
        slug: def.slug,
        description: def.description,
        section: reference.section ?? "tables",
        columns: columnDocs(def),
        rows,
        rowCount: rows.length,
        crmLists: [],
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });
    }
  }

  console.log(apply ? "\nDone." : "\nDry run finished. Re-run with --apply to write these changes.");
}

main()
  .catch((err) => {
    console.error("❌ CMS setup failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

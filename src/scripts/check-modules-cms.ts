/**
 * Read-only check: prints the cohort modules and quizzes exactly as the app
 * will read them from the CMS, and flags anything missing.
 *
 *   npm run cms:modules:check
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { CmsModulesService, MODULES_TABLE, QUIZ_QUESTIONS_TABLE } from "../services/cms-modules.service";
import { cmsSourceOf } from "../services/cms-table.service";
import { ModuleCatalogService, isQuizOpen, sessionState } from "../services/module-catalog.service";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  for (const def of [MODULES_TABLE, QUIZ_QUESTIONS_TABLE]) {
    const source = await cmsSourceOf(def);
    console.log(
      `${def.name}: ${
        source === "page"
          ? `Si Her DeFi (Base) page → "${def.page?.section}" → ${def.page?.list}`
          : source === "form"
            ? "form (Forms + Referrals) — move it to the Si Her DeFi (Base) page"
            : "not set up"
      }`
    );
  }
  const catalog = await CmsModulesService.getCatalog();

  if (!catalog) {
    console.log('❌ The "Si Her DeFi Modules" form/table was not found in the CMS.');
    return;
  }
  if (catalog.modules.length === 0) {
    console.log('⚠️  "Si Her DeFi Modules" exists but has no active rows yet.');
  }

  const warnings = [...catalog.warnings];
  let certificateModules = 0;

  for (const m of catalog.modules) {
    const questions = catalog.questionsByWeek.get(m.week) ?? [];
    const state = sessionState({
      videoUrl: m.videoUrl ?? undefined,
      scheduledDate: m.startsAt ?? undefined,
      endDate: m.endsAt ?? undefined,
    });
    const speakers = await ModuleCatalogService.speakersFor({ title: m.title, speakerNames: m.speakerNames });
    if (m.unlocksCertificate) certificateModules += 1;

    console.log(`\n${m.dateLabel} — ${m.title}  (/module/${m.slug})`);
    console.log(`  session:  ${m.startsAt ? m.startsAt.toISOString() : "no date"} · ${state}${isQuizOpen(state) ? " · quiz open" : ""}`);
    console.log(`  media:    thumbnail ${m.thumbnailUrl ? "✓" : "—"} · banner ${m.bannerUrl ? "✓" : "—"} · recording ${m.videoUrl ? "✓" : "—"} · ${m.chapters.length} chapter(s)`);
    console.log(`  speakers: ${speakers.map((s) => s.name).join(", ") || "none matched"}`);
    console.log(`  quiz:     ${questions.length} question(s) · ${m.quizAttempts} attempts · pass mark ${m.passMark ?? questions.length}`);
    console.log(`  badge:    ${m.badgeName}${m.unlocksCertificate ? " · UNLOCKS CERTIFICATE" : ""}`);

    if (!m.startsAt) warnings.push(`"${m.title}" has no Session Date — it shows as upcoming and its quiz stays closed.`);
    if (!m.thumbnailUrl) warnings.push(`"${m.title}" has no Thumbnail.`);
    if (questions.length === 0) warnings.push(`"${m.title}" (Week ${m.week}) has no quiz questions — it can't be completed.`);
    if (speakers.length === 0) {
      warnings.push(
        `"${m.title}": no speaker found in "SI<3> Speakers" — add the names in the module's Speakers field, or make the speaker's Session Title match.`
      );
    }
    m.chapters.length === 0 &&
      m.videoUrl &&
      warnings.push(`"${m.title}" has a recording but no Chapters.`);
    questions
      .filter((q) => m.videoUrl && !q.hintTimestamp)
      .forEach((q) => warnings.push(`"${m.title}" Q${q.order}: no Hint Timestamp — learners won't get a "rewatch" link.`));
  }

  const orphanWeeks = [...catalog.questionsByWeek.keys()].filter((w) => !catalog.modules.some((m) => m.week === w));
  orphanWeeks.forEach((w) => warnings.push(`Quiz questions exist for Week ${w}, but no active module has that Week.`));
  if (certificateModules === 0) warnings.push('No module has "Unlocks Certificate" = true — the certificate can never unlock.');

  console.log(`\nSummary: ${catalog.modules.length} module(s)`);
  console.log(warnings.length ? `\n⚠️  ${warnings.join("\n⚠️  ")}` : "\n✅ Everything the module pages need is in place.");
}

main()
  .catch((err) => {
    console.error("❌ Check failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

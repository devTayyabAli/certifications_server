/**
 * Read-only check: prints Si Her Onboard content exactly as the app will see
 * it from the CMS, and flags anything missing.
 *
 *   npm run cms:onboarding:check
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import {
  CmsOnboardingService,
  ONBOARDING_QUESTIONS_TABLE,
  ONBOARDING_SOCIALS_TABLE,
  ONBOARDING_TABLE,
} from "../services/cms-onboarding.service";
import { cmsSourceOf } from "../services/cms-table.service";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  for (const def of [ONBOARDING_TABLE, ONBOARDING_QUESTIONS_TABLE, ONBOARDING_SOCIALS_TABLE]) {
    const source = await cmsSourceOf(def);
    console.log(
      `${def.name}: ${
        source === "page"
          ? `Si Her DeFi (Base) page → "${def.page?.section}"${def.page?.list ? ` → ${def.page.list}` : ""}`
          : source === "form"
            ? "form (Forms + Referrals) — move it to the Si Her DeFi (Base) page"
            : "not set up"
      }`
    );
  }
  const content = await CmsOnboardingService.getPart("part1");

  if (!content) {
    console.log(
      "❌ Part 1 is not published. It needs an Active row with Part = \"Part 1\" and a Page Title in \"Si Her DeFi Onboarding\", " +
        "and at least one Active Part 1 question in \"Si Her DeFi Onboarding Questions\"."
    );
    return;
  }

  console.log(JSON.stringify(content, null, 2));

  const warnings: string[] = [];
  if (!content.video.url) warnings.push("Intro Video URL is empty or not an https:// link — page will say the video is coming soon.");
  if (!content.card.imageUrl) warnings.push("Dashboard Card Image is empty or not a valid link.");
  if (!content.video.posterUrl) warnings.push("Intro Video Poster is empty or not a valid link.");
  if (content.questions.length === 0) warnings.push("No active questions for Part 1.");
  if (content.socials.length === 0) warnings.push("No active socials for Part 1 (rows need Label and an https:// URL).");
  content.socials
    .filter((s) => !["x", "twitter", "linkedin", "instagram", "telegram", "youtube", "website"].includes(s.platform))
    .forEach((s) => warnings.push(`Social "${s.label}" has an unknown Platform "${s.platform}" — a generic icon is used.`));

  console.log(`\nSummary: ${content.questions.length} question(s), ${content.socials.length} social(s)`);
  console.log(warnings.length ? `\n⚠️  ${warnings.join("\n⚠️  ")}` : "\n✅ Everything the onboarding page needs is in place.");
}

main()
  .catch((err) => {
    console.error("❌ Check failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

/**
 * Resets a learner's module progress — completed modules, badges, quiz
 * attempts and the certificate unlock — so the module flow can be taken again
 * (test accounts, or progress made through the old completion shortcut).
 * Onboarding, profile and wallet are left untouched. A minted certificate is
 * never touched.
 *
 *   npm run progress:reset -- someone@example.com           # dry run
 *   npm run progress:reset -- someone@example.com --apply   # resets it
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { Certificate } from "../models/certificate.model";
import { UserProgress } from "../models/progress.model";
import { User } from "../models/user.model";

async function main() {
  const email = (process.argv.slice(2).find((a) => a.includes("@")) ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  if (!email) throw new Error("Pass the learner's email, e.g. npm run progress:reset -- someone@example.com");

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const user = await User.findOne({ email });
  if (!user) throw new Error(`No user with email ${email}`);

  const progress = await UserProgress.findOne({ user: user._id });
  const certificate = await Certificate.findOne({ user: user._id });

  console.log(`${email}:`);
  console.log(`  completed modules: ${progress?.completedModules.length ?? 0}`);
  console.log(`  badges:            ${progress?.earnedBadges.map((b) => b.badgeId).join(", ") || "none"}`);
  console.log(`  quiz attempts:     ${progress?.quizAttempts.length ?? 0}`);
  console.log(`  certificate:       ${certificate?.status ?? "none"}`);

  if (certificate?.status === "minted") {
    throw new Error("This learner's certificate is already minted on-chain — not resetting.");
  }
  if (!apply) {
    console.log("\nDry run — re-run with --apply to reset this progress.");
    return;
  }

  if (progress) {
    progress.completedModules = [];
    progress.earnedBadges = [];
    progress.quizAttempts = [];
    progress.hasPassedPrerequisiteForCertificate = false;
    await progress.save();
  }
  if (certificate) {
    certificate.status = "locked";
    await certificate.save();
  }
  console.log("\n✅ Module progress reset. Onboarding, profile and wallet were not changed.");
}

main()
  .catch((err) => {
    console.error("❌", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

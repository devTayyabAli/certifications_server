import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Profile } from "../models/profile.model";
import { UserProgress } from "../models/progress.model";
import { Survey } from "../models/survey.model";
import { Certificate } from "../models/certificate.model";
import { Otp } from "../models/otp.model";

async function main() {
  const email = "tayyabarine@gmail.com";
  console.log(`Connecting to MongoDB to reset all data for: ${email}...`);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // 1. Reset UserProgress (Badges, Quizzes, Completed Modules)
  const progress = await UserProgress.findOne({ user: user._id });
  if (progress) {
    progress.completedModules = [];
    progress.earnedBadges = [];
    progress.quizAttempts = [];
    progress.skippedQuizzes = [];
    progress.hasPassedPrerequisiteForCertificate = false;
    await progress.save();
    console.log("✅ UserProgress reset: 0 badges, 0 completed modules, 0 quiz attempts.");
  }

  // 2. Reset Certificate
  const certificate = await Certificate.findOne({ user: user._id });
  if (certificate) {
    certificate.status = "locked";
    (certificate as any).mintedAt = undefined;
    (certificate as any).transactionHash = undefined;
    (certificate as any).tokenId = undefined;
    await certificate.save();
    console.log("✅ Certificate reset: locked.");
  }

  // 3. Reset Surveys (Part 1 and Part 2 Onboarding)
  const surveyResult = await Survey.deleteMany({ user: user._id });
  console.log(`✅ Onboarding Surveys deleted: ${surveyResult.deletedCount} record(s) removed.`);

  // 4. Reset User wallet address and profile photo/bio if set
  user.walletAddress = undefined;
  await user.save();
  console.log("✅ User walletAddress cleared.");

  const profile = await Profile.findOne({ user: user._id });
  if (profile) {
    profile.photoUrl = null;
    profile.bio = "";
    await profile.save();
    console.log("✅ Profile photo & bio reset.");
  }

  // 5. Clear any pending OTPs
  await Otp.deleteMany({ email });
  console.log("✅ Pending OTPs cleared.");

  console.log("\n🎉 SUCCESS: All data for tayyabarine@gmail.com has been completely reset!");
}

main()
  .catch((err) => {
    console.error("❌ Reset error:", err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());

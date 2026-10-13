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
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const user = await User.findOne({ email });
  if (!user) {
    console.log("No user found with email:", email);
    return;
  }

  console.log("=== USER ===");
  console.log({
    _id: user._id,
    email: user.email,
    role: user.role,
    walletAddress: user.walletAddress,
    isEmailVerified: user.isEmailVerified,
    tokenVersion: user.tokenVersion,
  });

  const profile = await Profile.findOne({ user: user._id });
  console.log("=== PROFILE ===");
  console.log(profile);

  const progress = await UserProgress.findOne({ user: user._id });
  console.log("=== PROGRESS ===");
  console.log({
    completedModules: progress?.completedModules,
    earnedBadges: progress?.earnedBadges,
    quizAttempts: progress?.quizAttempts,
    hasPassedPrerequisiteForCertificate: progress?.hasPassedPrerequisiteForCertificate,
  });

  const surveys = await Survey.find({ user: user._id });
  console.log("=== SURVEYS ===");
  console.log(surveys.map(s => ({ type: s.surveyType, status: s.status, completedAt: s.completedAt })));

  const cert = await Certificate.findOne({ user: user._id });
  console.log("=== CERTIFICATE ===");
  console.log(cert?.status);
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());

/**
 * Resets a learner's Si Her Onboard – Part 1 so they can take it again
 * (e.g. a test account, or a submission made before the content was ready).
 *
 *   npm run onboarding:reset -- someone@example.com           # dry run
 *   npm run onboarding:reset -- someone@example.com --apply   # deletes it
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { Survey, isSurveyCompleted } from "../models/survey.model";
import { User } from "../models/user.model";

async function main() {
  const email = (process.argv.slice(2).find((a) => a.includes("@")) ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  if (!email) throw new Error("Pass the learner's email, e.g. npm run onboarding:reset -- someone@example.com");

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const user = await User.findOne({ email });
  if (!user) throw new Error(`No user with email ${email}`);

  const survey = await Survey.findOne({ user: user._id, surveyType: "part1" });
  if (!survey) {
    console.log(`${email} has no Part 1 record — nothing to reset.`);
    return;
  }

  console.log(
    `${email}: Part 1 is ${isSurveyCompleted(survey) ? "COMPLETED" : "a draft"}` +
      ` · ${survey.answers.length} answer(s) · ${survey.socialFollows?.length ?? 0} follow(s)` +
      (survey.completedAt ? ` · completed ${survey.completedAt.toISOString()}` : "")
  );

  if (!apply) {
    console.log("Dry run — re-run with --apply to delete this record.");
    return;
  }
  await Survey.deleteOne({ _id: survey._id });
  console.log("✅ Part 1 reset. The learner will see onboarding again on the dashboard.");
}

main()
  .catch((err) => {
    console.error("❌", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

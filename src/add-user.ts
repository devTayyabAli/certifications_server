import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { User } from "./models/user.model";
import { Profile } from "./models/profile.model";
import { UserProgress } from "./models/progress.model";
import { Settings } from "./models/settings.model";

async function registerUser(emailArg?: string, nameArg?: string) {
  const email = (emailArg || process.argv[2] || "").trim().toLowerCase();
  const name = (nameArg || process.argv[3] || "Tayyab Ali").trim();
  const role = "Web3 Developer";
  const organization = "Si Her DeFi Ecosystem";

  if (!email) {
    console.error("❌ Please provide an email: npm run add-user <email> [name]");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not found in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB. Registering: ${email} (${name})...`);

    // 1. Add / Update in certificates DB -> User
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        role: "member",
        isEmailVerified: true,
        isActive: true,
      });
      console.log(`✅ Created User document in "certificates.users" (ID: ${user._id})`);
    } else {
      user.isEmailVerified = true;
      await user.save();
      console.log(`ℹ️ User document already exists in "certificates.users" (ID: ${user._id}). Marked verified.`);
    }

    // 2. Add / Update in certificates DB -> Profile
    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      profile = await Profile.create({
        user: user._id,
        name,
        role,
        organization,
        socialLink: "https://linkedin.com",
        bio: "Web3 builder and DeFi enthusiast participating in Si Her DeFi cohort.",
        prefilledFields: ["name", "role", "organization"],
      });
      console.log(`✅ Created Profile document in "certificates.profiles"`);
    } else {
      profile.name = name;
      profile.role = role;
      profile.organization = organization;
      await profile.save();
      console.log(`ℹ️ Profile updated in "certificates.profiles"`);
    }

    // 3. Ensure UserProgress and Settings exist
    let progress = await UserProgress.findOne({ user: user._id });
    if (!progress) {
      await UserProgress.create({
        user: user._id,
        completedModules: [],
        earnedBadges: [],
      });
      console.log(`✅ Initialized UserProgress document`);
    }

    let settings = await Settings.findOne({ user: user._id });
    if (!settings) {
      await Settings.create({ user: user._id });
      console.log(`✅ Initialized Settings document`);
    }

    // 4. Also register in SI3 CMS -> Si Her DeFi Application table if available
    try {
      const conn = mongoose.connection as any;
      const cmsDb = conn.client ? conn.client.db("si3_cms") : conn.useDb("si3_cms").db;
      const form = await cmsDb.collection("forms").findOne({ slug: "siherdefi-application" });
      if (form && form.tableId) {
        const table = await cmsDb.collection("si3tables").findOne({ _id: form.tableId });
        if (table) {
          const emailCol = table.columns?.find((c: any) => c.name === "email")?.id || "f_email";
          const nameCol = table.columns?.find((c: any) => c.name === "your_name" || c.name === "full_name")?.id || "f_full_name";
          const roleCol = table.columns?.find((c: any) => c.name === "professional_role")?.id || "jqxyjy";
          const orgCol = table.columns?.find((c: any) => c.name === "organization")?.id || "tdlear";

          const existingRow = table.rows?.find((r: any) => r?.data?.[emailCol]?.toLowerCase() === email);
          if (!existingRow) {
            const newRow = {
              rowId: `row-${Date.now()}-user`,
              data: {
                [nameCol]: name,
                [emailCol]: email,
                [roleCol]: role,
                [orgCol]: organization,
                f_gender: "Yes",
                f_experience: "Intermediate",
                z9wz6l: "Excited to join the Si Her DeFi cohort!",
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              _id: new mongoose.Types.ObjectId(),
            };

            await cmsDb.collection("si3tables").updateOne(
              { _id: form.tableId },
              {
                $push: { rows: newRow as any },
                $inc: { rowCount: 1 },
              }
            );
            console.log(`✅ Successfully added application record to "si3_cms.si3tables" (Form: Si Her DeFi Application)`);
          } else {
            console.log(`ℹ️ Record already exists in "si3_cms.si3tables"`);
          }
        }
      }
    } catch (cmsErr: any) {
      console.warn("⚠️ Could not write to CMS table (non-critical):", cmsErr.message);
    }

    console.log("\n🎉 ALL DONE! Your record is now successfully registered in MongoDB.");
    console.log(`👉 You can now enter "${email}" on http://localhost:3000/siherdefi to claim your seat and get OTP!`);
    await mongoose.disconnect();
  } catch (error: any) {
    console.error("❌ Registration failed:", error);
    process.exit(1);
  }
}

registerUser();

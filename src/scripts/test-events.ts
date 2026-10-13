import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";
import { CmsEventsService } from "../services/cms-events.service";

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const events = await CmsEventsService.getAllEvents();
  console.log("=== EVENTS RESULT ===");
  console.log(events);
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());

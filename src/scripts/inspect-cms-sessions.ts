import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { env } from "../config/env";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const conn = mongoose.connection as any;
  const db = conn.client ? conn.client.db(env.APPLICATIONS_DB_NAME) : conn.useDb(env.APPLICATIONS_DB_NAME).db;

  const table = await db.collection("si3tables").findOne({ slug: "si-her-defi-sessions" });
  console.log("=== COLUMNS ===");
  console.log(table.columns);

  console.log("=== ROWS ===");
  console.dir(table.rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());

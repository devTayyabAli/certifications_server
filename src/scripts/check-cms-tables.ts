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

  const tables = await db.collection("si3tables").find({}, { projection: { slug: 1, name: 1, rowCount: 1 } }).toArray();
  console.log("=== SI3 CMS TABLES ===");
  console.log(tables);

  const collections = await db.listCollections().toArray();
  console.log("=== SI3 CMS COLLECTIONS ===");
  console.log(collections.map((c: any) => c.name));
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());

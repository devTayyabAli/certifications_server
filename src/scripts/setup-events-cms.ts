import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { EVENTS_TABLE, SEED_EVENTS } from "../services/cms-events.service";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const conn = mongoose.connection as any;
  const db = conn.client ? conn.client.db(env.APPLICATIONS_DB_NAME) : conn.useDb(env.APPLICATIONS_DB_NAME).db;

  const tables = db.collection("si3tables");

  // Check if table exists
  let table = await tables.findOne({ slug: EVENTS_TABLE.slug });
  if (!table) {
    const reference = await tables.findOne({ slug: "si-her-defi-sessions" });
    const projectId = reference?.projectId ?? null;

    const columns = EVENTS_TABLE.fields.map((f) => ({
      id: f.columnId,
      name: f.name,
      type: f.type,
      required: !!f.required,
      defaultValue: f.defaultValue ?? null,
      _id: new Types.ObjectId(),
    }));

    const rows = SEED_EVENTS.map((e, idx) => ({
      rowId: `row-${Date.now()}-${idx + 1}`,
      data: {
        "col-event-id": e.id,
        "col-event-kind": e.kind,
        "col-event-title": e.title,
        "col-event-subtitle": e.subtitle || "",
        "col-event-date": e.date,
        "col-event-time-tba": e.timeTba ? "true" : "false",
        "col-event-partner": e.partnerName || "",
        "col-event-link": e.link,
        "col-event-link-placeholder": e.linkIsPlaceholder ? "true" : "false",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      _id: new Types.ObjectId(),
    }));

    await tables.insertOne({
      name: EVENTS_TABLE.name,
      slug: EVENTS_TABLE.slug,
      description: EVENTS_TABLE.description,
      projectId,
      section: "tables",
      columns,
      rows,
      rowCount: rows.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Created "${EVENTS_TABLE.slug}" in SI3 CMS with ${rows.length} rows!`);
  } else {
    console.log(`ℹ️ "${EVENTS_TABLE.slug}" already exists in SI3 CMS with ${table.rowCount ?? table.rows?.length ?? 0} rows.`);
  }
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());

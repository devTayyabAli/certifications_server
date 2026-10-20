import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import mongoose from "mongoose";
import { env } from "../config/env";
import { cmsDb, SI_HER_DEFI_PAGE } from "../services/cms-table.service";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = cmsDb();
  const reference = await db.collection("si3tables").findOne({ slug: "si3-speakers" }, { projection: { projectId: 1 } });
  const page = await db.collection("schemas").findOne({
    ...(reference?.projectId ? { projectId: reference.projectId } : {}),
    slug: SI_HER_DEFI_PAGE.slug,
  });
  const docs = await db.collection("documents").find({ schemaId: page!._id }).toArray();
  for (const doc of docs) {
    const title = String(doc.title || doc.data?.tree?.name || "");
    if (!/quiz/i.test(title)) continue;
    const fields = (doc.data?.tree?.fields ?? []).flatMap((f: any) => f.subFields ?? []);
    console.log("subfields:", fields.map((f: any) => `${f.name}:${f.type}`).join(", "));
    const rows = (doc.data?.tree?.data?.quiz_questions ?? []) as Record<string, unknown>[];
    rows.forEach((r, i) => {
      console.log(
        JSON.stringify({
          i: i + 1,
          week: r.week,
          order: r.order,
          module: r.module ?? null,
          correct: r.correct_option,
          active: r.active,
          q: String(r.question ?? "").slice(0, 80),
        })
      );
    });
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());

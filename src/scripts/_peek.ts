import dns from "dns"; dns.setServers(["8.8.8.8", "1.1.1.1"]);
import dotenv from "dotenv"; import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import mongoose from "mongoose"; import { env } from "../config/env"; import { cmsDb, SI_HER_DEFI_PAGE } from "../services/cms-table.service";
const KEYS = ["questions_task_label", "questions_time_minutes", "task_note", "questions_header", "questions_intro"];
const norm = (v: any) => (v === undefined || v === null ? "" : typeof v === "string" ? v.trim() : v);
(async () => { await mongoose.connect(env.MONGODB_URI); const db = cmsDb();
  const ref = await db.collection("si3tables").findOne({ slug: "si3-speakers" }, { projection: { projectId: 1 } });
  const page = await db.collection("schemas").findOne({ projectId: ref?.projectId, slug: SI_HER_DEFI_PAGE.slug });
  const doc = (await db.collection("documents").findOne({ schemaId: page!._id, title: "Onboarding" }))!;
  const t = doc.data.tree; const sub = (t.children ?? []).find((c: any) => c._key === "research_questions");
  console.log(`saved ${doc.updatedAt?.toISOString()} | published=${doc.published} | parent still has: ${KEYS.concat("questions").filter((k) => t.fields.some((f: any) => f.name === k)).join(", ") || "none of the old fields"}`);
  if (!sub) { console.log("NO SUB-SECTION"); return; }
  let bad = 0;
  for (const k of KEYS) { const a = norm(t.data?.[k]), b = norm(sub.data?.[k]); const same = String(a) === String(b); if (!same) bad++; console.log(`${same ? "OK  " : "DIFF"} ${k}: new=${JSON.stringify(b).slice(0, 70)}${same ? "" : ` | old=${JSON.stringify(a).slice(0, 70)}`}`); }
  const oq = t.data?.questions ?? [], nq = sub.data?.questions ?? [];
  console.log(`questions: old ${oq.length} items, new ${nq.length} items`);
  nq.forEach((q: any, i: number) => { const o = oq.find((x: any) => Number(x.order) === Number(q.order)) ?? oq[i] ?? {};
    for (const f of ["order", "question", "placeholder", "hint", "max_characters", "required", "active"]) { if (String(norm(o[f])) !== String(norm(q[f]))) { bad++; console.log(`DIFF Q${i + 1}.${f}: new=${JSON.stringify(q[f])} old=${JSON.stringify(o[f])}`); } } });
  console.log(bad ? `${bad} difference(s)` : "ALL VALUES MATCH");
  await mongoose.disconnect(); })();

/**
 * Sends a test calendar invite, update or cancellation for a made-up session
 * ("Si Her DeFi: Test Session") — the same email the app sends, without
 * touching any real module or learner. Run the steps in order:
 *
 *   npx tsx src/scripts/test-calendar-invite.ts invite a@example.com b@example.com
 *   npx tsx src/scripts/test-calendar-invite.ts update a@example.com b@example.com
 *   npx tsx src/scripts/test-calendar-invite.ts cancel a@example.com b@example.com
 *
 * "update" moves the session an hour later and changes its link, so the
 * calendar event should move rather than a second one appear.
 */
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { env } from "../config/env";
import { EmailService } from "../services/email.service";
import { generateInviteIcs } from "../utils/calendar-generator";

const UID = "invite-test-session@si3.space";
const BASE = { start: new Date("2026-10-30T16:00:00Z"), link: "https://ro.am/" };
const STEPS = {
  invite: { sequence: 0, method: "REQUEST" as const, shiftHours: 0, link: BASE.link, note: "" },
  update: {
    sequence: 1,
    method: "REQUEST" as const,
    shiftHours: 1,
    link: "https://ro.am/?updated=1",
    note: "New time: one hour later. New session link.",
  },
  cancel: { sequence: 2, method: "CANCEL" as const, shiftHours: 1, link: "https://ro.am/?updated=1", note: "" },
};

async function main() {
  const [step, ...emails] = process.argv.slice(2) as [keyof typeof STEPS, ...string[]];
  if (!STEPS[step] || emails.length === 0 || emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
    console.log("Usage: npx tsx src/scripts/test-calendar-invite.ts <invite|update|cancel> <email> [email…]");
    process.exit(1);
  }
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error("SMTP isn't configured in .env");

  const s = STEPS[step];
  const start = new Date(BASE.start.getTime() + s.shiftHours * 3600_000);
  const end = new Date(start.getTime() + 3600_000);
  const title = "Si Her DeFi: Test Session";
  const transporter = await EmailService.getTransporter();

  for (const email of emails) {
    const ics = generateInviteIcs(
      { uid: UID, title, description: "A test of the Si Her DeFi calendar invites. Safe to ignore.", startDate: start, endDate: end, url: s.link },
      { method: s.method, sequence: s.sequence, organizer: { name: "Si Her DeFi", email: env.SMTP_USER }, attendee: { email } }
    );
    const subject =
      step === "cancel" ? `Cancelled: ${title}` : step === "update" ? `Updated invitation: ${title}` : `Invitation: ${title}`;
    const text = [subject, s.note, "", `${start.toUTCString()} (1 hour)`, step !== "cancel" ? `Join: ${s.link}` : ""]
      .filter(Boolean)
      .join("\n");
    await transporter.sendMail({ from: env.SMTP_FROM, to: email, subject, text, icalEvent: { method: s.method, filename: "invite.ics", content: ics } });
    console.log(`✅ ${step} sent to ${email}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("❌", (err as Error).message);
    process.exit(1);
  }
);

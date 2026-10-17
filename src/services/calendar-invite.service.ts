import { Types } from "mongoose";
import { env } from "../config/env";
import { CalendarSchedule, ICalendarSchedule } from "../models/calendar-schedule.model";
import { IModule, Module } from "../models/module.model";
import { Profile } from "../models/profile.model";
import { User } from "../models/user.model";
import { generateInviteIcs } from "../utils/calendar-generator";
import { calendarEvent, isTimeZone } from "../utils/module-calendar";
import { EmailService } from "./email.service";

/**
 * Calendar invites by email, sent from the cohort's own address (SMTP_USER,
 * e.g. dao@si3.space). A learner asks for one from "Add to calendar"; the
 * invite has Accept / Decline in Gmail, Outlook, Apple Mail and Proton, and
 * puts the session in their calendar — no .ics file to import.
 *
 * When the team later changes a session's date, time, link or title in the
 * CMS, everyone who got an invite is sent an update that changes the event
 * already in their calendar (same UID, higher SEQUENCE), with a note on what
 * changed. A session that's removed, or that the learner takes off their
 * list, gets a cancellation.
 */

const SYNC_INTERVAL_MS = 60 * 1000;
/** Emails per pass, so a pass never holds up a learner's request for long; the rest go next pass */
const MAX_SENDS_PER_PASS = 10;
/** Asking again within this window doesn't send a second copy */
const RESEND_AFTER_MS = 60 * 1000;

let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

type Kind = "new" | "update" | "cancel";

export function invitesEnabled() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

function organizer() {
  // "Si Her DeFi <dao@si3.space>" → its display name; the address is the SMTP account itself,
  // so replies (Accepted / Declined) come back to it
  const name = env.SMTP_FROM.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || "Si Her DeFi";
  return { name, email: env.SMTP_USER };
}

function inviteUid(moduleId: Types.ObjectId | string) {
  return `invite-${moduleId}@si3.space`;
}

function when(start: Date, end: Date, timeZone: string) {
  const tz = isTimeZone(timeZone) ? timeZone : "UTC";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz }).format(start);
  const t = (d: Date, zone: boolean) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, ...(zone ? { timeZoneName: "short" } : {}) }).format(d);
  return { day, time: `${t(start, false)} – ${t(end, true)}`, full: `${day}, ${t(start, false)} – ${t(end, true)}` };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function emailBody(kind: Kind, title: string, slot: { day: string; time: string }, link: string, changes: string[]) {
  const heading =
    kind === "cancel" ? "This session has been cancelled" : kind === "update" ? "This session has changed" : "You're invited";
  const intro =
    kind === "cancel"
      ? "It has been removed from your calendar. Check the Si Her DeFi app for the latest schedule."
      : kind === "update"
        ? "Your calendar event has been updated."
        : "Accept this invite to add the session to your calendar. If the time or link changes, we'll send you an update automatically.";
  const appUrl = env.FRONTEND_URL.replace(/\/+$/, "");

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f6f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171730">
<div style="max-width:560px;margin:0 auto;padding:28px 14px">
<div style="background:#fff;border:1px solid #e9e8f0;border-radius:16px;padding:26px">
<p style="margin:0 0 6px;font-size:12px;color:#7c2ae8;font-weight:600">Si Her DeFi</p>
<h1 style="margin:0 0 10px;font-size:20px">${esc(heading)}</h1>
${changes.length ? `<div style="margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;font-size:13px;color:#92400e">${changes.map(esc).join("<br>")}</div>` : ""}
<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4b4b66">${esc(intro)}</p>
<div style="border:1px solid #eee8f8;background:#faf9fd;border-radius:12px;padding:16px">
<p style="margin:0 0 8px;font-size:16px;font-weight:600${kind === "cancel" ? ";text-decoration:line-through" : ""}">${esc(title)}</p>
<p style="margin:0;font-size:13.5px;color:#4b4b66">${esc(slot.day)}<br>${esc(slot.time)}</p>
${kind !== "cancel" && link ? `<p style="margin:12px 0 0;font-size:13.5px"><a href="${esc(link)}" style="color:#7c2ae8">Join the session</a></p>` : ""}
</div>
<p style="margin:18px 0 0;font-size:12px;color:#8e8ea6">Sent because you asked for a calendar invite in the <a href="${esc(appUrl)}" style="color:#8e8ea6">Si Her DeFi app</a>.</p>
</div></div></body></html>`;

  const text = [
    heading,
    ...changes,
    "",
    intro,
    "",
    title,
    `${slot.day}, ${slot.time}`,
    kind !== "cancel" && link ? `Join: ${link}` : "",
    "",
    `Sent because you asked for a calendar invite in the Si Her DeFi app: ${appUrl}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return { html, text };
}

interface Slot {
  start: Date;
  end: Date;
  link: string;
  title: string;
}

/** The session as it is now, in the shape an invite records. */
function slotOf(moduleDoc: IModule): Slot {
  const e = calendarEvent(moduleDoc);
  return { start: e.startDate, end: e.endDate, link: e.url, title: e.title };
}

/**
 * Sends one invite, update or cancellation for `base` (the session now, or as
 * last sent for a cancellation). Throws if the mail server refuses it.
 */
async function send(
  kind: Kind,
  moduleDoc: IModule,
  to: { email: string; name?: string },
  sequence: number,
  timeZone: string,
  base: Slot,
  changes: string[] = []
) {
  const payload = {
    uid: inviteUid(moduleDoc._id as Types.ObjectId),
    title: base.title,
    description:
      moduleDoc.calendarDescription ||
      `${moduleDoc.description}${moduleDoc.presenter ? `\n\nPresented by: ${moduleDoc.presenter}` : ""}`,
    location: moduleDoc.location || "Si Her DeFi Virtual Stage",
    startDate: base.start,
    endDate: base.end,
    url: base.link,
  };
  const method = kind === "cancel" ? "CANCEL" : "REQUEST";
  const ics = generateInviteIcs(payload, { method, sequence, organizer: organizer(), attendee: to });
  const slot = when(base.start, base.end, timeZone);
  const { html, text } = emailBody(kind, base.title, slot, base.link, changes);
  const subject =
    kind === "cancel"
      ? `Cancelled: ${base.title} @ ${slot.full}`
      : kind === "update"
        ? `Updated invitation: ${base.title} @ ${slot.full}`
        : `Invitation: ${base.title} @ ${slot.full}`;

  const transporter = await EmailService.getTransporter();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: to.name ? { name: to.name, address: to.email } : to.email,
    subject,
    text,
    html,
    // the text/calendar part is what mail apps show as an invite with Accept / Decline
    icalEvent: { method, filename: "invite.ics", content: ics },
  });
}

async function learnerName(userId: Types.ObjectId) {
  const profile = await Profile.findOne({ user: userId }, { name: 1 });
  return profile?.name?.trim() || undefined;
}

/** What changed between the invite as sent and the session now, in the learner's time zone. */
function describeChanges(before: Slot, now: Slot, timeZone: string) {
  const changes: string[] = [];
  if (before.start.getTime() !== now.start.getTime() || before.end.getTime() !== now.end.getTime()) {
    changes.push(`New time: ${when(now.start, now.end, timeZone).full} (was ${when(before.start, before.end, timeZone).full})`);
  }
  if (before.link !== now.link) changes.push(`New session link: ${now.link}`);
  if (before.title !== now.title) changes.push(`New title: ${now.title}`);
  return changes;
}

async function syncNow() {
  const pending = await CalendarSchedule.find({ invite: { $ne: null }, "invite.cancelledAt": null }).limit(500);
  if (pending.length === 0) return;
  const modules = await Module.find({ _id: { $in: pending.map((s) => s.module) } });
  const byId = new Map(modules.map((m) => [String(m._id), m]));

  let sent = 0;
  for (const schedule of pending) {
    if (sent >= MAX_SENDS_PER_PASS) break;
    const invite = schedule.invite!;
    const moduleDoc = byId.get(String(schedule.module));
    const before: Slot = { start: invite.start, end: invite.end, link: invite.link, title: invite.title };
    const to = { email: invite.email, name: await learnerName(schedule.user) };

    try {
      // the session is gone (removed from the CMS, or no date any more): cancel it
      if (!moduleDoc || !moduleDoc.isPublished || !moduleDoc.scheduledDate) {
        if (!moduleDoc) {
          // nothing to build the cancellation from: just stop tracking it
          schedule.invite = { ...invite, cancelledAt: new Date(), error: null };
        } else {
          sent += 1;
          await send("cancel", moduleDoc, to, invite.sequence + 1, schedule.timezone ?? "UTC", before);
          schedule.invite = { ...invite, sequence: invite.sequence + 1, sentAt: new Date(), cancelledAt: new Date(), error: null };
        }
        await schedule.save();
        continue;
      }

      const now = slotOf(moduleDoc);
      const changes = describeChanges(before, now, schedule.timezone ?? "UTC");
      if (changes.length === 0) continue;

      sent += 1;
      await send("update", moduleDoc, to, invite.sequence + 1, schedule.timezone ?? "UTC", now, changes);
      schedule.invite = { ...invite, ...now, sequence: invite.sequence + 1, sentAt: new Date(), error: null };
      // the app's "time changed" notice is about the learner's own calendar: this update fixed it
      schedule.scheduledDate = now.start;
      schedule.endDate = now.end;
      await schedule.save();
    } catch (err) {
      // kept as it was, so the next pass tries again
      console.warn(`⚠️ Calendar invite update to a learner failed:`, (err as Error).message);
      await CalendarSchedule.updateOne({ _id: schedule._id }, { $set: { "invite.error": (err as Error).message.slice(0, 300) } });
    }
  }
}

export class CalendarInviteService {
  /**
   * Emails the learner an invite for a module's live session (or sends it
   * again). Returns where it went.
   */
  static async invite(moduleDoc: IModule, userId: Types.ObjectId, timeZone?: string) {
    const user = await User.findById(userId, { email: 1 });
    if (!user?.email) throw new Error("Your account has no email address to send the invite to.");
    const tz = isTimeZone(timeZone) ? timeZone : "UTC";
    const now = slotOf(moduleDoc);

    const existing = await CalendarSchedule.findOne({ user: userId, module: moduleDoc._id });
    const previous = existing?.invite ?? null;
    const recent =
      previous &&
      !previous.cancelledAt &&
      previous.email === user.email &&
      Date.now() - new Date(previous.sentAt).getTime() < RESEND_AFTER_MS;

    // the same invite again (higher sequence), or a fresh one after a cancellation
    const sequence = previous ? previous.sequence + 1 : 0;
    if (!recent) await send("new", moduleDoc, { email: user.email, name: await learnerName(userId) }, sequence, tz, now);

    const schedule = await CalendarSchedule.findOneAndUpdate(
      { user: userId, module: moduleDoc._id },
      {
        user: userId,
        module: moduleDoc._id,
        calendarType: "email",
        sessionTitle: moduleDoc.title,
        scheduledDate: now.start,
        endDate: now.end,
        timezone: tz,
        status: "scheduled",
        ...(recent
          ? {}
          : { invite: { email: user.email, sequence, sentAt: new Date(), ...now, cancelledAt: null, error: null } }),
      },
      { upsert: true, new: true }
    );
    return { schedule, email: user.email, resent: !!previous && !recent };
  }

  /** The learner took the session off their list: cancel the invite they got. Best effort. */
  static async cancelFor(schedule: ICalendarSchedule, moduleDoc: IModule) {
    const invite = schedule.invite;
    if (!invite || invite.cancelledAt || !invitesEnabled()) return;
    try {
      await send(
        "cancel",
        moduleDoc,
        { email: invite.email, name: await learnerName(schedule.user) },
        invite.sequence + 1,
        schedule.timezone ?? "UTC",
        { start: invite.start, end: invite.end, link: invite.link, title: invite.title }
      );
    } catch (err) {
      console.warn("⚠️ Could not send the invite cancellation:", (err as Error).message);
    }
  }

  /**
   * Sends updates and cancellations for sessions that changed since their
   * invites went out. Runs at most once a minute, from learners' requests.
   */
  static async syncInvites() {
    if (!invitesEnabled() || Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;
    if (!inFlight) {
      inFlight = syncNow()
        .catch((err) => console.warn("⚠️ Calendar invite sync failed:", (err as Error).message))
        .finally(() => {
          lastSyncAt = Date.now();
          inFlight = null;
        });
    }
    await inFlight;
  }
}

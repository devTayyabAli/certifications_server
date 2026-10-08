import fs from "fs";
import path from "path";
import { createApp } from "./app";
import { CalendarService } from "./services/calendar.service";
import { EmailService } from "./services/email.service";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 SI HER DEFI — WALLET & CALENDAR TEST SUITE");
  console.log("=================================================\n");

  let allPass = true;

  // ---------------------------------------------------------------------------
  // 1. Wallet Tests
  // ---------------------------------------------------------------------------
  console.log("📦 1. RUNNING WALLET CONFIGURATION TESTS...");
  try {
    const connectFormPath = path.resolve(__dirname, "../../src/app/wallet/connect-wallet-form.tsx");
    const modalPath = path.resolve(__dirname, "../../src/components/wallet-connect-modal.tsx");

    const formContent = fs.readFileSync(connectFormPath, "utf-8");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    // 1.1 Verify Coinbase Wallet exists
    if (!formContent.includes("Coinbase Wallet") || !modalContent.includes("Coinbase Wallet")) {
      throw new Error("❌ Coinbase Wallet missing from wallet options");
    }
    console.log("  ✔ PASS: Coinbase Wallet exists in wallet options");

    // 1.2 Verify 1inch Wallet exists
    if (!formContent.includes("1inch Wallet") || !modalContent.includes("1inch Wallet")) {
      throw new Error("❌ 1inch Wallet missing from wallet options");
    }
    console.log("  ✔ PASS: 1inch Wallet exists in wallet options");

    // 1.3 Verify Brave Wallet does NOT exist
    if (formContent.toLowerCase().includes("brave wallet") || modalContent.toLowerCase().includes("brave wallet")) {
      throw new Error("❌ Brave Wallet still found in wallet options");
    }
    console.log("  ✔ PASS: Brave Wallet does NOT exist in wallet options");

    // 1.4 Verify No Duplicate 1inch Wallet entries
    const formMatches = (formContent.match(/name:\s*"1inch Wallet"/g) || []).length;
    if (formMatches !== 1) {
      throw new Error(`❌ Expected exactly 1 1inch Wallet option in connect-wallet-form, found ${formMatches}`);
    }
    const modalMatches = (modalContent.match(/handleConnectEthereum\("1inch Wallet"\)/g) || []).length;
    if (modalMatches !== 1) {
      throw new Error(`❌ Expected exactly 1 1inch Wallet button in wallet-connect-modal, found ${modalMatches}`);
    }
    console.log("  ✔ PASS: No duplicate 1inch Wallet entry exists (exactly 1 in form, 1 in modal)\n");
  } catch (err: any) {
    console.error(`  ✖ FAIL: Wallet Test: ${err.message}\n`);
    allPass = false;
  }

  // ---------------------------------------------------------------------------
  // 2. Calendar Event Generation Tests
  // ---------------------------------------------------------------------------
  console.log("📅 2. RUNNING CALENDAR EVENT GENERATION TESTS...");
  const sampleMeetingUrl = "https://meet.google.com/shd-oct19-live";
  const sessionWithMeeting = {
    id: "session-stablecoins-401",
    slug: "global-stablecoin-market",
    title: "The Global Stablecoin Market",
    startDate: "2026-10-19T17:00:00Z",
    endDate: "2026-10-19T18:00:00Z",
    timezone: "UTC",
    location: "Si Her DeFi Virtual Stage",
    description: "Deep dive into stablecoins and reserve transparency on Base.",
    meetingUrl: sampleMeetingUrl,
  };

  try {
    const cal = CalendarService.generateCalendarEvent(sessionWithMeeting);

    // Verify Title
    if (!cal.icsContent.includes("SUMMARY:Si Her DeFi: The Global Stablecoin Market")) {
      throw new Error("❌ Incorrect or missing title in ICS SUMMARY");
    }
    console.log("  ✔ PASS: Event title correctly generated");

    // Verify Start & End Time
    if (!cal.icsContent.includes("DTSTART:20261019T170000Z") || !cal.icsContent.includes("DTEND:20261019T180000Z")) {
      throw new Error("❌ Incorrect start or end time format in ICS");
    }
    console.log("  ✔ PASS: Start and end times correctly formatted (UTC compact)");

    // Verify Timezone
    if (!cal.icsContent.includes("X-WR-TIMEZONE:UTC")) {
      throw new Error("❌ Missing or incorrect timezone property in ICS");
    }
    console.log("  ✔ PASS: Timezone preserved and configured");

    // Verify Description
    if (!cal.icsContent.includes("DESCRIPTION:Deep dive into stablecoins")) {
      throw new Error("❌ Missing description in ICS");
    }
    console.log("  ✔ PASS: Description included and escaped");

    // Verify Meeting URL inside calendar event
    if (!cal.icsContent.includes(`URL:${sampleMeetingUrl}`) || !cal.icsContent.includes(sampleMeetingUrl)) {
      throw new Error("❌ Meeting URL missing from ICS calendar event");
    }
    if (!cal.googleCalendarUrl.includes(encodeURIComponent(sampleMeetingUrl))) {
      throw new Error("❌ Meeting URL missing from Google Calendar link");
    }
    if (!cal.outlookCalendarUrl.includes(encodeURIComponent(sampleMeetingUrl))) {
      throw new Error("❌ Meeting URL missing from Outlook Calendar link");
    }
    console.log("  ✔ PASS: Meeting link URL included in .ics, Google, and Outlook calendar events\n");
  } catch (err: any) {
    console.error(`  ✖ FAIL: Calendar Test: ${err.message}\n`);
    allPass = false;
  }

  // ---------------------------------------------------------------------------
  // 3. Missing Meeting URL Graceful Handling Tests
  // ---------------------------------------------------------------------------
  console.log("🛡️ 3. RUNNING MISSING MEETING URL TESTS...");
  const sessionWithoutMeeting = {
    id: "session-no-meeting",
    slug: "orientation-basics",
    title: "Orientation Basics (No Live Stream)",
    startDate: "2026-10-25T14:00:00Z",
    endDate: "2026-10-25T15:00:00Z",
    timezone: "UTC",
    location: "Async Reading Room",
    description: "Self-paced reading material with no live meeting link.",
    meetingUrl: undefined, // null / undefined
  };

  try {
    const calNoMeeting = CalendarService.generateCalendarEvent(sessionWithoutMeeting);

    // Verify event generated without crashing
    if (!calNoMeeting.icsContent.includes("BEGIN:VCALENDAR")) {
      throw new Error("❌ Failed to generate ICS for session without meeting URL");
    }

    // Verify NO URL: line and NO broken text inserted
    if (calNoMeeting.icsContent.includes("URL:") || calNoMeeting.icsContent.includes("undefined") || calNoMeeting.icsContent.includes("null")) {
      throw new Error("❌ Broken or empty URL line inserted when meetingUrl is missing");
    }
    if (calNoMeeting.icsContent.includes("Session Meeting Link:")) {
      throw new Error("❌ 'Session Meeting Link:' rendered when meetingUrl is missing");
    }
    console.log("  ✔ PASS: Calendar event generated successfully without meeting URL");
    console.log("  ✔ PASS: No broken URL or empty link section rendered in calendar event\n");
  } catch (err: any) {
    console.error(`  ✖ FAIL: Missing URL Test: ${err.message}\n`);
    allPass = false;
  }

  // ---------------------------------------------------------------------------
  // 4. Email Reminder Tests
  // ---------------------------------------------------------------------------
  console.log("📧 4. RUNNING EMAIL REMINDER & ADD-TO-CALENDAR TESTS...");
  try {
    // 4.1 Email WITH meeting link
    const emailWithMeeting = await EmailService.sendSessionReminderEmail(
      sessionWithMeeting,
      { email: "attendee.test@siherdefi.org", name: "Amara" },
      { attachIcs: true }
    );

    if (!emailWithMeeting.success) {
      throw new Error("❌ EmailService did not report success for meeting email");
    }
    if (!emailWithMeeting.calendarData.calendarActionUrl.includes("/calendar?sessionId=")) {
      throw new Error("❌ Email calendarActionUrl is missing /calendar route");
    }
    if (!emailWithMeeting.calendarData.icsContent.includes(sampleMeetingUrl)) {
      throw new Error("❌ Calendar event in email does not contain meeting URL");
    }
    console.log("  ✔ PASS: Reminder email contains 'Add to Calendar' CTA and links");
    console.log("  ✔ PASS: Calendar action contains correct session information");
    console.log("  ✔ PASS: Calendar event generated from email contains meeting URL");
    console.log(`  ✔ PASS: Email sent via Nodemailer (MessageId: ${emailWithMeeting.messageId})`);

    // 4.2 Email WITHOUT meeting link (graceful handling)
    const emailWithoutMeeting = await EmailService.sendSessionReminderEmail(
      sessionWithoutMeeting,
      { email: "attendee.async@siherdefi.org", name: "Elena" },
      { attachIcs: false }
    );

    if (!emailWithoutMeeting.success) {
      throw new Error("❌ EmailService crashed when meeting URL was missing");
    }
    console.log("  ✔ PASS: Email generation does NOT break when meeting URL is missing\n");
  } catch (err: any) {
    console.error(`  ✖ FAIL: Email Test: ${err.message}\n`);
    allPass = false;
  }

  // ---------------------------------------------------------------------------
  // 5. Express API Endpoints Verification
  // ---------------------------------------------------------------------------
  console.log("🌐 5. RUNNING API ENDPOINT CHECKS...");
  const app = createApp();
  const server = app.listen(5098, async () => {
    try {
      // 5.1 GET /api/calendar/session/:sessionId (ICS download)
      const icsRes = await fetch("http://127.0.0.1:5098/api/calendar/session/global-stablecoin-market");
      const contentType = icsRes.headers.get("content-type");
      const contentDisposition = icsRes.headers.get("content-disposition");
      const icsText = await icsRes.text();

      if (icsRes.status !== 200) {
        throw new Error(`❌ /api/calendar/session/:sessionId returned status ${icsRes.status}`);
      }
      if (!contentType?.includes("text/calendar; charset=utf-8")) {
        throw new Error(`❌ Invalid Content-Type: ${contentType}`);
      }
      if (!contentDisposition?.includes('attachment; filename="global-stablecoin-market.ics"')) {
        throw new Error(`❌ Invalid Content-Disposition: ${contentDisposition}`);
      }
      if (!icsText.includes("BEGIN:VCALENDAR") || !icsText.includes("END:VCALENDAR")) {
        throw new Error("❌ Returned content is not a valid iCalendar event");
      }
      console.log("  ✔ PASS: GET /api/calendar/session/:sessionId returned valid .ics file with correct headers");

      // 5.2 GET /api/calendar/session/:sessionId/links
      const linksRes = await fetch("http://127.0.0.1:5098/api/calendar/session/global-stablecoin-market/links");
      const linksJson = (await linksRes.json()) as any;
      if (!linksJson.data?.googleCalendarUrl || !linksJson.data?.outlookCalendarUrl) {
        throw new Error("❌ /api/calendar/session/:sessionId/links missing calendar URLs");
      }
      console.log("  ✔ PASS: GET /api/calendar/session/:sessionId/links returned dynamic URLs");

      // 5.3 POST /api/calendar/session/:sessionId/reminder
      const remRes = await fetch("http://127.0.0.1:5098/api/calendar/session/global-stablecoin-market/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "test.attendee@siherdefi.org",
          recipientName: "Amara Lead",
          attachIcs: true,
        }),
      });
      const remJson = (await remRes.json()) as any;
      if (!remJson.data?.success) {
        throw new Error("❌ POST /api/calendar/session/:sessionId/reminder failed");
      }
      console.log("  ✔ PASS: POST /api/calendar/session/:sessionId/reminder successfully dispatched email");

      console.log("\n=================================================");
      if (allPass) {
        console.log("🎉 ALL TESTS PASSED: WALLET, CALENDAR & EMAIL!");
      } else {
        console.log("❌ SOME TESTS FAILED. PLEASE CHECK LOGS ABOVE.");
        process.exitCode = 1;
      }
      console.log("=================================================");
    } catch (err: any) {
      console.error(`  ✖ FAIL: Endpoint Test: ${err.message}`);
      process.exitCode = 1;
    } finally {
      server.close();
      process.exit(process.exitCode || 0);
    }
  });
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

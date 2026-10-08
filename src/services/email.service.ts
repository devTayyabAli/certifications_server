import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { CalendarService, CalendarSessionInput, GeneratedCalendarResult } from "./calendar.service";

export interface RecipientInput {
  email: string;
  name?: string;
}

export interface SendSessionReminderOptions {
  attachIcs?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  recipient: string;
  calendarData: GeneratedCalendarResult;
  simulated?: boolean;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Lazily get or create Nodemailer transporter from SMTP environment variables.
   * If SMTP_HOST is not configured, creates a Nodemailer test account (Ethereal) in development.
   */
  static async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (env.SMTP_HOST && env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });
      return this.transporter;
    }

    // Development fallback using Ethereal test account if credentials are not provided
    console.warn("⚠️ SMTP credentials not fully configured. Creating ethereal test account for email testing...");
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`📧 Ethereal test mailer ready. User: ${testAccount.user}`);
    } catch {
      // In case of network sandbox or offline dev, create stream/json transport
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "windows",
        buffer: true,
      });
    }

    return this.transporter;
  }

  /**
   * Send session reminder email with "Add to Calendar" CTA, meeting link, and optional .ics attachment.
   */
  static async sendSessionReminderEmail(
    session: CalendarSessionInput,
    recipient: RecipientInput,
    options: SendSessionReminderOptions = {}
  ): Promise<SendEmailResult> {
    if (!recipient || !recipient.email) {
      throw new Error("Recipient email is required to send reminder email");
    }

    // 1. Generate consistent calendar event and URLs
    const cal = CalendarService.generateCalendarEvent(session);
    const recipientName = recipient.name || recipient.email.split("@")[0] || "Cohort Member";
    const meetingUrl = cal.session.meetingUrl;

    // 2. Build responsive HTML template
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Reminder: ${cal.session.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f6f5fa;
      color: #171730;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f6f5fa;
      padding: 32px 12px;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e9e8f0;
      box-shadow: 0 4px 20px rgba(23, 23, 48, 0.05);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #171730 0%, #291a52 100%);
      padding: 32px 28px;
      text-align: left;
    }
    .logo-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      background-color: rgba(255, 255, 255, 0.12);
      color: #d1bbfb;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      line-height: 1.3;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 15px;
      line-height: 1.6;
      color: #4b4b66;
      margin-bottom: 24px;
    }
    .session-card {
      background-color: #faf9fd;
      border: 1px solid #eee8f8;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .session-title {
      font-size: 17px;
      font-weight: 700;
      color: #171730;
      margin: 0 0 14px 0;
    }
    .meta-row {
      display: flex;
      margin-bottom: 10px;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .meta-label {
      width: 90px;
      font-weight: 600;
      color: #7b7b99;
      flex-shrink: 0;
    }
    .meta-value {
      font-weight: 500;
      color: #1c1c38;
    }
    .session-desc {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2dbf0;
      font-size: 13px;
      line-height: 1.55;
      color: #5d5d7e;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn-primary {
      display: inline-block;
      background-color: #7c2ae8;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 13px 28px;
      border-radius: 10px;
      margin-right: 8px;
      margin-bottom: 10px;
    }
    .btn-secondary {
      display: inline-block;
      background-color: #171730;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 13px 28px;
      border-radius: 10px;
      margin-bottom: 10px;
    }
    .quick-cal-box {
      background-color: #ffffff;
      border: 1px solid #e7e6f0;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      margin-top: 24px;
    }
    .quick-cal-title {
      font-size: 12px;
      font-weight: 700;
      color: #707090;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .cal-link {
      display: inline-block;
      padding: 6px 12px;
      margin: 3px 4px;
      border-radius: 6px;
      background-color: #f1edfa;
      color: #5d1bb5 !important;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }
    .footer {
      background-color: #faf9fd;
      padding: 24px;
      text-align: center;
      font-size: 11.5px;
      color: #9292a8;
      border-top: 1px solid #ebe8f4;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="email-container">
      <div class="header">
        <span class="logo-badge">SI HER DEFI COHORT</span>
        <h1>Upcoming Session Reminder</h1>
      </div>

      <div class="content">
        <p class="greeting">
          Hi <strong>${recipientName}</strong>,<br>
          Your next live cohort session is coming up soon. Here are the details and your direct access link:
        </p>

        <div class="session-card">
          <div class="session-title">${cal.session.title}</div>
          <div class="meta-row">
            <span class="meta-label">📅 Date:</span>
            <span class="meta-value">${cal.formattedDate}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">⏰ Time:</span>
            <span class="meta-value">${cal.formattedTime}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">📍 Location:</span>
            <span class="meta-value">${cal.session.location || "Si Her DeFi Virtual Stage"}</span>
          </div>
          ${
            cal.session.presenter
              ? `<div class="meta-row"><span class="meta-label">🎙️ Presenter:</span><span class="meta-value">${cal.session.presenter}</span></div>`
              : ""
          }
          <div class="session-desc">
            ${cal.session.description || "Interactive workshop exploring on-chain primitives and smart contract architecture."}
          </div>
        </div>

        <div class="cta-container">
          ${
            meetingUrl
              ? `<a href="${meetingUrl}" class="btn-primary" target="_blank" rel="noopener noreferrer">
            Join Session
          </a>`
              : ""
          }
          <a href="${cal.calendarActionUrl}" class="btn-secondary" target="_blank" rel="noopener noreferrer">
            Add to Calendar
          </a>
        </div>

        <div class="quick-cal-box">
          <div class="quick-cal-title">Direct 1-Click Calendar Options</div>
          <a href="${cal.googleCalendarUrl}" class="cal-link" target="_blank" rel="noopener noreferrer">Google Calendar</a>
          <a href="${cal.outlookCalendarUrl}" class="cal-link" target="_blank" rel="noopener noreferrer">Outlook</a>
          <a href="${cal.office365CalendarUrl}" class="cal-link" target="_blank" rel="noopener noreferrer">Office 365</a>
          <a href="${cal.calendarActionUrl}" class="cal-link" target="_blank" rel="noopener noreferrer">Apple / .ics</a>
        </div>
      </div>

      <div class="footer">
        <p>© 2026 Si Her DeFi · Empowering Web3 Leaders on Base.</p>
        <p>You received this email because you are registered for the Si Her DeFi Cohort.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // 3. Optional Nodemailer .ics attachment
    const attachments = options.attachIcs
      ? [
          {
            filename: cal.filename,
            content: cal.icsContent,
            contentType: "text/calendar; charset=utf-8; method=REQUEST",
          },
        ]
      : [];

    const transporter = await this.getTransporter();

    const mailOptions = {
      from: env.SMTP_FROM,
      to: recipient.email,
      subject: `Reminder: ${cal.session.title} (${cal.formattedDate})`,
      text: [
        `Si Her DeFi Session Reminder: ${cal.session.title}`,
        `Date: ${cal.formattedDate}`,
        `Time: ${cal.formattedTime}`,
        `Location: ${cal.session.location || "Si Her DeFi Virtual Stage"}`,
        cal.session.description ? `Description: ${cal.session.description}` : "",
        ``,
        meetingUrl ? `Join Session: ${meetingUrl}` : "",
        `Add to Calendar: ${cal.calendarActionUrl}`,
        ``,
        `Direct Google Calendar: ${cal.googleCalendarUrl}`,
        `Direct Outlook Calendar: ${cal.outlookCalendarUrl}`,
        `Download .ics: ${env.FRONTEND_URL}/api/calendar/session/${session.slug || session.id}`,
      ]
        .filter((line, idx, arr) => line !== "" || (idx > 0 && arr[idx - 1] !== ""))
        .join("\n"),
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(`\n📬 [EMAIL SENT] Preview URL: ${previewUrl}\n`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      recipient: recipient.email,
      calendarData: cal,
    };
  }
}

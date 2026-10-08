/**
 * RFC 5545 iCalendar (.ics) and Calendar Link Generator
 * Compliant with Apple Calendar, Google Calendar, Microsoft Outlook, and universal iCal consumers.
 */

export interface CalendarEventPayload {
  uid?: string;
  title: string;
  description?: string;
  location?: string;
  startDate: Date | string;
  endDate?: Date | string;
  url?: string;
  timezone?: string;
  organizerName?: string;
  organizerEmail?: string;
}

/**
 * Validate and sanitize URL (prevent javascript: or data: injection)
 */
export function sanitizeCalendarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (
    trimmed === "" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase().startsWith("javascript:") ||
    trimmed.toLowerCase().startsWith("data:") ||
    trimmed.toLowerCase().startsWith("vbscript:")
  ) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return undefined;
  } catch {
    // If not a valid absolute URL, check if valid relative path
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }
    return undefined;
  }
}

/**
 * Ensure valid Date object. Fallback to now + 7 days if invalid.
 */
export function parseValidDate(dateInput: Date | string | undefined, defaultOffsetHours = 0): Date {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
  }
  if (typeof dateInput === "string" || typeof dateInput === "number") {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const fallback = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (defaultOffsetHours !== 0) {
    fallback.setTime(fallback.getTime() + defaultOffsetHours * 60 * 60 * 1000);
  }
  return fallback;
}

/**
 * Format a Date to UTC ISO compact string (YYYYMMDDTHHMMSSZ) for standard calendar interoperability
 */
export function formatCalendarUtcDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Fold long lines per RFC 5545 (Lines of text SHOULD NOT be longer than 75 octets)
 */
export function foldIcsLine(line: string, maxLen = 75): string {
  if (line.length <= maxLen) return line;
  const chunks: string[] = [];
  let current = line;

  // First chunk up to maxLen
  chunks.push(current.substring(0, maxLen));
  current = current.substring(maxLen);

  // Subsequent folded lines start with a single space
  while (current.length > maxLen - 1) {
    chunks.push(` ${current.substring(0, maxLen - 1)}`);
    current = current.substring(maxLen - 1);
  }
  if (current.length > 0) {
    chunks.push(` ${current}`);
  }

  return chunks.join("\r\n");
}

/**
 * Escape text characters per RFC 5545 Section 3.3.11:
 * Backslash, semicolon, comma, and newline characters must be escaped.
 */
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Generate standard Google Calendar event template URL
 */
export function generateGoogleCalendarUrl(event: CalendarEventPayload): string {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const startStr = formatCalendarUtcDate(start);
  const endStr = formatCalendarUtcDate(end);

  const sanitizedUrl = sanitizeCalendarUrl(event.url);
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\nJoin Session: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: fullDescription,
    location: event.location || "Si Her DeFi Virtual Stage",
  });

  if (event.timezone && event.timezone !== "UTC") {
    params.set("ctz", event.timezone);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook.com / Microsoft Live calendar deeplink URL
 */
export function generateOutlookCalendarUrl(event: CalendarEventPayload): string {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const sanitizedUrl = sanitizeCalendarUrl(event.url);
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\nJoin Session: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: fullDescription,
    location: event.location || "Si Her DeFi Virtual Stage",
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Microsoft Office 365 calendar deeplink URL
 */
export function generateOffice365CalendarUrl(event: CalendarEventPayload): string {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const sanitizedUrl = sanitizeCalendarUrl(event.url);
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\nJoin Session: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: fullDescription,
    location: event.location || "Si Her DeFi Virtual Stage",
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate standard RFC 5545 iCalendar (.ics) content for Apple Calendar, Outlook, and universal iCal
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const uid = event.uid || `siherdefi-${Date.now()}@siherdefi.org`;
  const dtStamp = formatCalendarUtcDate(new Date());
  const dtStart = formatCalendarUtcDate(start);
  const dtEnd = formatCalendarUtcDate(end);
  const timezone = event.timezone || "UTC";

  const sanitizedUrl = sanitizeCalendarUrl(event.url);
  const summary = escapeIcsText(event.title);
  const descWithUrl = (event.description || "Si Her DeFi Cohort Learning Session") +
    (sanitizedUrl ? `\n\nSession Meeting Link: ${sanitizedUrl}` : "");
  const description = escapeIcsText(descWithUrl);
  const location = escapeIcsText(event.location || "Si Her DeFi Virtual Stage");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Si Her DeFi//Cohort Learning Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Si Her DeFi Sessions",
    `X-WR-TIMEZONE:${timezone}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    ...(sanitizedUrl ? [`URL:${sanitizedUrl}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map((l) => foldIcsLine(l)).join("\r\n");
}

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
  /** No start time yet: shown as an all-day event on its date */
  allDay?: boolean;
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
  const isRoam = sanitizedUrl?.includes("ro.am");
  const joinLabel = isRoam ? "Join Roam Session" : "Join Session";
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\n${joinLabel}: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const locationStr = sanitizedUrl
    ? `${event.location || "Si Her DeFi Virtual Stage"} (${sanitizedUrl})`
    : event.location || "Si Her DeFi Virtual Stage";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: fullDescription,
    location: locationStr,
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
  const isRoam = sanitizedUrl?.includes("ro.am");
  const joinLabel = isRoam ? "Join Roam Session" : "Join Session";
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\n${joinLabel}: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const locationStr = sanitizedUrl
    ? `${event.location || "Si Her DeFi Virtual Stage"} (${sanitizedUrl})`
    : event.location || "Si Her DeFi Virtual Stage";

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: fullDescription,
    location: locationStr,
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
  const isRoam = sanitizedUrl?.includes("ro.am");
  const joinLabel = isRoam ? "Join Roam Session" : "Join Session";
  const fullDescription = [
    event.description || "Si Her DeFi Cohort Learning Session",
    sanitizedUrl ? `\n\n${joinLabel}: ${sanitizedUrl}` : "",
  ].filter(Boolean).join("");

  const locationStr = sanitizedUrl
    ? `${event.location || "Si Her DeFi Virtual Stage"} (${sanitizedUrl})`
    : event.location || "Si Her DeFi Virtual Stage";

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: fullDescription,
    location: locationStr,
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** "20261209": an all-day date, from the event's UTC calendar day. */
function formatCalendarDate(date: Date): string {
  return formatCalendarUtcDate(date).slice(0, 8);
}

/** Calendar reminders a day and an hour before the session. */
function reminderAlarms(summary: string): string[] {
  return ["-P1D", "-PT1H"].flatMap((trigger) => [
    "BEGIN:VALARM",
    `TRIGGER:${trigger}`,
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${summary}`,
    "END:VALARM",
  ]);
}

/** One VEVENT (with reminders a day and an hour before), unfolded. */
function icsEventLines(event: CalendarEventPayload): string[] {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const uid = event.uid || `siherdefi-${Date.now()}@siherdefi.org`;
  const dtStamp = formatCalendarUtcDate(new Date());
  // A date without a time yet is an all-day event (DTEND is exclusive: the next day)
  const when = event.allDay
    ? [
        `DTSTART;VALUE=DATE:${formatCalendarDate(start)}`,
        `DTEND;VALUE=DATE:${formatCalendarDate(new Date(start.getTime() + 24 * 60 * 60 * 1000))}`,
      ]
    : [`DTSTART:${formatCalendarUtcDate(start)}`, `DTEND:${formatCalendarUtcDate(end)}`];

  const sanitizedUrl = sanitizeCalendarUrl(event.url);
  const isRoam = sanitizedUrl?.includes("ro.am");
  const joinLabel = isRoam ? "Roam Session Link" : "Session Meeting Link";
  const summary = escapeIcsText(event.title);
  const descWithUrl = (event.description || "Si Her DeFi Cohort Learning Session") +
    (sanitizedUrl ? `\n\n${joinLabel}: ${sanitizedUrl}` : "");
  const description = escapeIcsText(descWithUrl);
  const location = escapeIcsText(
    sanitizedUrl
      ? `${event.location || "Si Her DeFi Virtual Stage"} (${sanitizedUrl})`
      : event.location || "Si Her DeFi Virtual Stage"
  );

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    ...when,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    ...(sanitizedUrl ? [`URL:${sanitizedUrl}`] : []),
    "STATUS:CONFIRMED",
    event.allDay ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE",
    "SEQUENCE:0",
    // An all-day placeholder gets no "starts soon" alerts
    ...(event.allDay ? [] : reminderAlarms(summary)),
    "END:VEVENT",
  ];
}

/**
 * Generate standard RFC 5545 iCalendar (.ics) content for Apple Calendar, Outlook, and universal iCal
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Si Her DeFi//Cohort Learning Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Si Her DeFi Sessions",
    `X-WR-TIMEZONE:${event.timezone || "UTC"}`,
    ...icsEventLines(event),
    "END:VCALENDAR",
  ];

  return lines.map((l) => foldIcsLine(l)).join("\r\n");
}

export interface InviteOptions {
  /** REQUEST = a new or updated invite; CANCEL = remove it from the attendee's calendar */
  method: "REQUEST" | "CANCEL";
  /** goes up by one with every update, so calendars replace the older version */
  sequence: number;
  organizer: { name: string; email: string };
  attendee: { name?: string; email: string };
}

/**
 * A calendar invite (iTIP, RFC 5546) sent by email: Gmail, Outlook, Apple and
 * Proton show it with Accept / Decline and put it in the attendee's calendar.
 * Updates reuse the UID with a higher SEQUENCE, so they change the event in
 * place; a CANCEL removes it.
 */
export function generateInviteIcs(event: CalendarEventPayload, opts: InviteOptions): string {
  const start = parseValidDate(event.startDate);
  const end = event.endDate ? parseValidDate(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
  const url = sanitizeCalendarUrl(event.url);
  const description = escapeIcsText(
    (event.description || "Si Her DeFi Cohort Learning Session") + (url ? `\n\nJoin: ${url}` : "")
  );
  const cancel = opts.method === "CANCEL";
  const cn = (s: string) => s.replace(/[";:,\r\n]/g, " ").trim();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Si Her DeFi//Session Invites//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${formatCalendarUtcDate(new Date())}`,
    `DTSTART:${formatCalendarUtcDate(start)}`,
    `DTEND:${formatCalendarUtcDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${escapeIcsText(url ?? event.location ?? "Si Her DeFi Virtual Stage")}`,
    ...(url ? [`URL:${url}`] : []),
    `ORGANIZER;CN=${cn(opts.organizer.name)}:mailto:${opts.organizer.email}`,
    `ATTENDEE;CN=${cn(opts.attendee.name || opts.attendee.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${opts.attendee.email}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(cancel ? [] : reminderAlarms(escapeIcsText(event.title))),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map((l) => foldIcsLine(l)).join("\r\n");
}

/**
 * A calendar learners subscribe to by URL (Google, Apple, Proton, Outlook): every
 * session in one feed. Each event keeps its UID, so a changed time or link
 * updates the event in place when the calendar app refreshes.
 */
export function generateIcsFeed(events: CalendarEventPayload[], name = "Si Her DeFi"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Si Her DeFi//Cohort Learning Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    "X-WR-CALDESC:Every Si Her DeFi live session and cohort event. Times and links update automatically.",
    // How often calendar apps should check for changes (most treat it as a hint)
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...events.flatMap(icsEventLines),
    "END:VCALENDAR",
  ];

  return lines.map((l) => foldIcsLine(l)).join("\r\n");
}

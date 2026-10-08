/** Calendars a learner can add a session to from the app. */
export const CALENDAR_TYPES = ["google", "apple", "outlook", "proton", "other"] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export const CALENDAR_LABELS: Record<CalendarType, string> = {
  google: "Google Calendar",
  apple: "Apple Calendar",
  outlook: "Outlook",
  proton: "Proton Calendar",
  other: "your calendar",
};

/** Anything unknown (a plain .ics download, etc.) is recorded as "other". */
export function toCalendarType(value: unknown): CalendarType {
  return CALENDAR_TYPES.includes(value as CalendarType) ? (value as CalendarType) : "other";
}

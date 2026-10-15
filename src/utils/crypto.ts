import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateOtp(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}

export async function hashValue(value: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(value, salt);
}

export async function compareHash(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * Public certificate code, e.g. "SHD-7K2Q-9XMP-4TRB". Random (60 bits) so a
 * certificate's public page can't be found by guessing; no 0/O/1/I to keep
 * it easy to read out.
 */
export function generateVerificationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `SHD-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * The secret part of a learner's private calendar-feed link. Calendar apps
 * can't sign in, so the link itself is the key: `<userId>.<signature>`.
 * Signed with CALENDAR_FEED_SECRET (falling back to JWT_SECRET), so rotating
 * the JWT secret needn't break links people already subscribed to.
 */
export function calendarFeedToken(userId: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(`calendar-feed:${userId}`).digest("base64url");
  return `${userId}.${signature.slice(0, 32)}`;
}

/** The learner a feed token belongs to, or null when it was tampered with. */
export function userIdFromCalendarFeedToken(token: string, secret: string): string | null {
  const userId = token.split(".")[0];
  if (!/^[a-f0-9]{24}$/i.test(userId)) return null;
  const expected = Buffer.from(calendarFeedToken(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? userId : null;
}

import { createHash } from "crypto";
import { Request } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

/**
 * Rate limits, layered from broad to specific:
 *  - general:       every request, per IP
 *  - auth:          sign-in endpoints, per IP
 *  - otpEmail:      sign-in codes sent to one email address, from any IP
 *  - write:         changes made by one signed-in learner
 *  - publicLookup:  unauthenticated lookups (certificate verification)
 *
 * IPs are only accurate behind a proxy when TRUST_PROXY is set (see app.ts).
 */

const common = { standardHeaders: "draft-7" as const, legacyHeaders: false };

function limited(message: string) {
  return (_req: Request, _res: unknown, next: (err?: unknown) => void) => next(ApiError.tooManyRequests(message));
}

export const generalRateLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  handler: limited("Too many requests from this network. Please try again in a few minutes."),
});

export const authRateLimiter = rateLimit({
  ...common,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  handler: limited("Too many sign-in attempts. Please wait a few minutes before trying again."),
});

/** Stops anyone flooding a learner's inbox with codes, however many IPs they use. */
export const otpEmailRateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: env.OTP_EMAIL_MAX_PER_HOUR,
  keyGenerator: (req) => `otp:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  skip: (req) => typeof req.body?.email !== "string" || !req.body.email.trim(),
  handler: limited("Too many sign-in codes were requested for this email. Please try again in an hour."),
});

/**
 * Changes (POST/PUT/PATCH/DELETE) per signed-in learner. Keyed by a hash of
 * the bearer token so learners sharing one network don't share a budget.
 */
export const writeRateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: env.WRITE_RATE_LIMIT_PER_MINUTE,
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    return auth ? `token:${createHash("sha256").update(auth).digest("hex")}` : `ip:${req.ip}`;
  },
  handler: limited("You're making changes too quickly. Please wait a moment and try again."),
});

/** Public lookups by code — slows down anyone trying to guess certificate codes. */
export const publicLookupRateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 30,
  handler: limited("Too many lookups. Please wait a minute and try again."),
});

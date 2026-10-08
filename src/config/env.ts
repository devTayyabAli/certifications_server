import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Configuration loaded from .env

/** Only for local development — production refuses to start with it. */
const DEV_JWT_SECRET = "super_secret_jwt_key_siherdefi_2026_change_in_production";

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/siherdefi"),
  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default("7d"),
  // Tokens are only accepted when issued by this API for this app
  JWT_ISSUER: z.string().default("siherdefi-api"),
  JWT_AUDIENCE: z.string().default("siherdefi-app"),
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  // Proxies in front of the API (Render, Nginx, Cloudflare…): 1 for one hop.
  // Needed so rate limits see each learner's real IP, not the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Body size cap — profile photos are resized in the browser to well under this
  BODY_LIMIT: z.string().default("3mb"),
  BASE_CHAIN_ID: z.coerce.number().default(8453),
  RPC_URL: z.string().default("https://mainnet.base.org"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  // Per IP. One dashboard load alone makes ~10 API calls, and a cohort on the
  // same office / campus network shares one IP — keep this generous.
  RATE_LIMIT_MAX: z.coerce.number().default(1000),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(600000), // 10 mins
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  // Sign-in codes sent to any one email address, per hour (stops inbox flooding)
  OTP_EMAIL_MAX_PER_HOUR: z.coerce.number().default(5),
  // Changes (POST/PUT/PATCH/DELETE) per signed-in learner, per minute
  WRITE_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),
  // SMTP Email Configuration
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default('"Si Her DeFi" <no-reply@siherdefi.org>'),
  FRONTEND_URL: z.string().default("http://localhost:3000/siherdefi"),
  // Access control: only applicants in the SI3 CMS application table may sign in
  APPLICATIONS_DB_NAME: z.string().default("si3_cms"),
  APPLICATION_FORM_SLUG: z.string().default("siherdefi-application"),
  // Comma-separated emails allowed in even without an application (team, testers)
  ALLOWED_EMAILS: z.string().default(""),
  // CRM lists (SI3 CMS → Members → Lists) whose people may sign in, and lists that block sign-in
  APPROVED_LISTS: z.string().default("Si Her DeFi Approved,Si Her DeFi Members"),
  DENIED_LISTS: z.string().default("Si Her DeFi Denied"),
  // Loops.so Email Delivery Configuration
  LOOPS_API_KEY: z.string().default(""),
  LOOPS_TRANSACTIONAL_ID: z.string().default(""),
  LOOPS_EVENT_NAME: z.string().default("otp_verification"),
  // On-chain certificate. Minting stays switched off until a contract is set.
  CERTIFICATE_CONTRACT_ADDRESS: z.string().default(""),
  CERTIFICATE_CHAIN: z.enum(["base", "base-sepolia"]).default("base"),
  // Development only — see applyDevOverrides in cms-modules.service.ts
  DEV_SESSION_OVERRIDES: z.string().default(""),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  // Browsers send only scheme + host (+ port), so "https://app.com/siherdefi/"
  // is reduced to "https://app.com" — a pasted page URL still works
  corsOrigins: parsedEnv.data.CORS_ORIGIN.split(",")
    .map((value) => {
      const trimmed = value.trim();
      try {
        return new URL(trimmed).origin;
      } catch {
        return trimmed.replace(/\/+$/, "");
      }
    })
    .filter((origin) => origin && origin !== "null"),
  allowedEmails: parsedEnv.data.ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  approvedLists: parsedEnv.data.APPROVED_LISTS.split(",").map((l) => l.trim()).filter(Boolean),
  deniedLists: parsedEnv.data.DENIED_LISTS.split(",").map((l) => l.trim()).filter(Boolean),
};

/**
 * Production must not run with development shortcuts: a weak or default JWT
 * secret, localhost origins, or a non-https app URL. Problems stop the
 * server instead of quietly shipping an insecure setup.
 */
if (env.NODE_ENV === "production") {
  const problems: string[] = [];
  if (env.JWT_SECRET === DEV_JWT_SECRET || env.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be a unique random value of at least 32 characters (e.g. `openssl rand -hex 32`).");
  }
  if (env.corsOrigins.length === 0) problems.push("CORS_ORIGIN must list the app's https origin(s).");
  const insecureOrigins = env.corsOrigins.filter((o) => !/^https:\/\//.test(o));
  if (insecureOrigins.length > 0) {
    problems.push(`CORS_ORIGIN must only contain https origins (found: ${insecureOrigins.join(", ")}).`);
  }
  if (!/^https:\/\//.test(env.FRONTEND_URL)) problems.push("FRONTEND_URL must be the app's https URL.");
  if (env.DEV_SESSION_OVERRIDES) problems.push("DEV_SESSION_OVERRIDES must be empty in production.");

  if (problems.length > 0) {
    console.error(`❌ Refusing to start in production:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
}

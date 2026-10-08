import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { ensureDatabase } from "./config/database";
import { env } from "./config/env";
import { HttpStatus } from "./constants/http-status";
import { globalErrorHandler } from "./middlewares/error.middleware";
import { generalRateLimiter, writeRateLimiter } from "./middlewares/rate-limiter.middleware";
import { sanitizeInputs } from "./middlewares/sanitize.middleware";
import { v1Router } from "./routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { ApiError } from "./utils/api-error";
import { ApiResponse } from "./utils/api-response";

/** Local dev servers on any port (localhost / 127.0.0.1) — development only. */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin: string) {
  if (env.corsOrigins.includes(origin)) return true;
  return env.NODE_ENV === "development" && LOCAL_ORIGIN.test(origin);
}

export function createApp(options: { connectOnRequest?: boolean } = {}): Application {
  const app = express();

  // 0. Behind a proxy, read the learner's real IP from X-Forwarded-For (only
  //    as many hops as configured — never trust it blindly)
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  // 1. Security HTTP Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // JSON API — no HTML to protect
      crossOriginEmbedderPolicy: false,
      // .ics files and public data are opened from the app's own origin
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // 2. CORS: only the app's own origins. Browsers from any other site get a
  //    clear 403 instead of a confusing server error. Requests without an
  //    Origin (server-to-server, calendar apps, curl) carry no browser
  //    credentials and are allowed through.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return ApiResponse.error(res, 403, "This origin is not allowed to use the Si Her DeFi API.");
    }
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
      // Auth is a Bearer token, not cookies — never send credentials cross-site
      credentials: false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
      maxAge: 600, // cache preflights for 10 minutes
    })
  );

  // 3. Rate limiting protection (per IP)
  app.use(generalRateLimiter);

  // 4. Request body parsing — small cap so oversized payloads are refused early
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));

  // 5. Input sanitization (NoSQL injection prevention)
  app.use(sanitizeInputs);

  // 6. Changes per signed-in learner (on top of the per-IP limit)
  app.use("/api", writeRateLimiter);

  // 7. Request logging (method, path, status — never headers or bodies)
  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  // 7b. Serverless: open (or reuse) the database connection before routing
  if (options.connectOnRequest) {
    app.use(async (req: Request, _res: Response, next) => {
      if (req.path === "/health") return next();
      try {
        await ensureDatabase();
        next();
      } catch (err) {
        console.error("❌ MongoDB connection failed:", (err as Error).message);
        next(new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "The service is temporarily unavailable. Please try again."));
      }
    });
  }

  // 7. Base and Health check endpoints
  app.get("/", (_req: Request, res: Response) => {
    return ApiResponse.success(res, {
      message: "Si Her DeFi Backend API is active",
      data: {
        version: "v1",
        docs: "/api/v1",
        status: "healthy",
      },
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    return ApiResponse.success(res, {
      message: "Server is healthy",
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
    });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    const isDbReady = mongoose.connection.readyState === 1;
    return ApiResponse.success(res, {
      message: isDbReady ? "Server and Database ready" : "Database not ready",
      data: {
        databaseReady: isDbReady,
        readyState: mongoose.connection.readyState,
      },
    });
  });

  // 8. Mount Direct Calendar endpoints for Universal Calendar & Email Links
  app.use("/api/calendar", calendarRoutes);

  // 9. Mount Version 1 Master API
  app.use("/api/v1", v1Router);

  // 9. Catch-all 404 for undefined routes
  app.use((req: Request, _res: Response, next) => {
    next(ApiError.notFound(`Cannot find route: ${req.method} ${req.originalUrl}`));
  });

  // 10. Global Centralized Error Handling Middleware
  app.use(globalErrorHandler);

  return app;
}

/**
 * Vercel entry point. Vercel looks for `src/app.ts` and serves its default
 * export as a single function; the database connects on the first request
 * and is reused after that. Locally, `npm run dev` runs src/server.ts instead.
 */
const serverlessApp = createApp({ connectOnRequest: true });
export default serverlessApp;

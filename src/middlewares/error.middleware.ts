import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpStatus } from "../constants/http-status";
import { ApiError } from "../utils/api-error";
import { ApiResponse } from "../utils/api-response";

export function globalErrorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  let error = err;

  // Handle SyntaxError (e.g. malformed JSON payload)
  if (err instanceof SyntaxError && "body" in err) {
    error = ApiError.badRequest("Malformed JSON payload in request body");
  }

  // Body over the size limit (body-parser)
  if ((err as { type?: string }).type === "entity.too.large") {
    error = new ApiError(HttpStatus.PAYLOAD_TOO_LARGE, "Request is too large.");
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === "CastError") {
    error = ApiError.badRequest("Invalid resource ID format");
  }

  // Handle Mongoose duplicate key error (E11000)
  if ((err as { code?: number }).code === 11000) {
    const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern || {})[0] || "field";
    error = ApiError.conflict(`An entry with this ${field} already exists`);
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError") {
    const details = Object.values((err as { errors?: Record<string, { message: string }> }).errors || {}).map(
      (e) => e.message
    );
    error = ApiError.badRequest("Database validation error", details);
  }

  // Determine status code & message
  const statusCode = error instanceof ApiError ? error.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
  const message = error.message || "Internal server error";
  const errors = error instanceof ApiError ? error.errors : undefined;

  if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
    console.error("💥 Unhandled Application Error:", err);
  }

  // Unexpected failures never expose their internal message outside development
  const safeMessage =
    statusCode === HttpStatus.INTERNAL_SERVER_ERROR && env.NODE_ENV !== "development"
      ? "Something went wrong. Please try again."
      : message;

  return ApiResponse.error(
    res,
    statusCode,
    safeMessage,
    // Stack traces only for real server errors, and only in development
    errors ||
      (env.NODE_ENV === "development" && statusCode === HttpStatus.INTERNAL_SERVER_ERROR && err.stack
        ? { stack: err.stack }
        : undefined)
  );
}

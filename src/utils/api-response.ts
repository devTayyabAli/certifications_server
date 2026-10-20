import { Response } from "express";
import { HttpStatus, HttpStatusCode } from "../constants/http-status";

export interface ApiResponseOptions<T> {
  statusCode?: HttpStatusCode;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export class ApiResponse {
  /**
   * Let Vercel's edge keep a public response for a minute. The browser still
   * asks again (max-age=0); the edge can answer without waking the US function.
   * Only for responses that are the same for every learner.
   */
  static cachePublic(res: Response, seconds = 60) {
    res.setHeader(
      "Cache-Control",
      `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds}`
    );
  }

  static success<T>(
    res: Response,
    {
      statusCode = HttpStatus.OK,
      message = "Success",
      data,
      meta,
    }: ApiResponseOptions<T>
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static created<T>(res: Response, message: string = "Created successfully", data?: T) {
    return this.success(res, { statusCode: HttpStatus.CREATED, message, data });
  }

  static error(
    res: Response,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string = "Error",
    errors?: unknown
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}

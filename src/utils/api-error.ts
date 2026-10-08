import { HttpStatus, HttpStatusCode } from "../constants/http-status";

export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string = "Something went wrong",
    errors?: unknown,
    isOperational: boolean = true,
    stack: string = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(msg: string, errors?: unknown) {
    return new ApiError(HttpStatus.BAD_REQUEST, msg, errors);
  }

  static unauthorized(msg: string = "Unauthorized") {
    return new ApiError(HttpStatus.UNAUTHORIZED, msg);
  }

  static forbidden(msg: string = "Forbidden access") {
    return new ApiError(HttpStatus.FORBIDDEN, msg);
  }

  static notFound(msg: string = "Resource not found") {
    return new ApiError(HttpStatus.NOT_FOUND, msg);
  }

  static conflict(msg: string) {
    return new ApiError(HttpStatus.CONFLICT, msg);
  }

  static tooManyRequests(msg: string = "Too many requests. Please try again later.") {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, msg);
  }

  static internal(msg: string = "Internal server error") {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, msg, undefined, false);
  }
}

import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { IUser, User } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { AccessTokenPayload, verifyAccessToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticateJwt = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization ?? "";
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/);
  if (!match) {
    throw ApiError.unauthorized("Authentication token is missing");
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Your session has expired. Please sign in again.");
    }
    throw ApiError.unauthorized("Invalid authentication token");
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("User account not found or deactivated");
  }
  // Signed out (or signed out everywhere) since this token was issued
  if ((user.tokenVersion ?? 0) !== payload.tv) {
    throw ApiError.unauthorized("Your session has ended. Please sign in again.");
  }

  req.user = user;
  next();
});

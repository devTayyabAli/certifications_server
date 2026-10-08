import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { IUser } from "../models/user.model";

/**
 * Access tokens: HS256 only, bound to this API (issuer) and this app
 * (audience), and to the learner's current `tokenVersion` so a logout
 * revokes every token issued before it.
 */

const ALGORITHM = "HS256" as const;

export interface AccessTokenPayload {
  /** User id */
  sub: string;
  email: string;
  role: string;
  /** User.tokenVersion at sign-in */
  tv: number;
}

export function signAccessToken(user: IUser): string {
  const payload: AccessTokenPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    tv: user.tokenVersion ?? 0,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

/** Throws jwt errors (TokenExpiredError, JsonWebTokenError) on any problem. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [ALGORITHM], // never let the token pick its own algorithm
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (typeof decoded === "string" || !decoded.sub) {
    throw new jwt.JsonWebTokenError("Malformed token");
  }
  return decoded as unknown as AccessTokenPayload;
}

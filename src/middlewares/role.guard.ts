import { NextFunction, Request, Response } from "express";
import { UserRole } from "../models/user.model";
import { ApiError } from "../utils/api-error";

export function authorizeRole(allowedRoles: UserRole | UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }

    next();
  };
}

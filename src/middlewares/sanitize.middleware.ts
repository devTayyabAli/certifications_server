import { NextFunction, Request, Response } from "express";

function cleanObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Strip leading dollar signs or dots which can be used in MongoDB query injection
    const cleanKey = key.replace(/^\$|\./g, "");
    cleaned[cleanKey] = cleanObject(value);
  }
  return cleaned;
}

export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = cleanObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = cleanObject(req.query) as Request["query"];
  }
  if (req.params && typeof req.params === "object") {
    req.params = cleanObject(req.params) as Request["params"];
  }
  next();
}

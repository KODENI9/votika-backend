import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Attach Clerk authentication to every request.
 * This populates `req.auth` with the Clerk session data.
 * Must be mounted before any route that uses requireAuth or requireRole.
 */
export const clerkAuth = clerkMiddleware();

/**
 * Guard middleware — ensures the request has a valid Clerk session.
 * Throws 401 if not authenticated.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return next(ApiError.unauthorized("Authentification requise"));
  }
  next();
}

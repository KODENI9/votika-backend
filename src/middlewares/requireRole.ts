import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { logger } from "../utils/logger";

export type UserRole = "creator" | "admin";

/**
 * Role guard middleware factory.
 * Checks the `role` field stored in Clerk `publicMetadata`.
 * Usage: router.use(requireRole("admin"))
 *
 * @param role The required role
 */
export function requireRole(role: UserRole) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return next(ApiError.unauthorized());
      }

      // Fetch the full user object from Clerk to read publicMetadata
      const user = await clerkClient.users.getUser(auth.userId);
      const userRole = (user.publicMetadata as { role?: string }).role;

      if (userRole !== role) {
        logger.warn("Forbidden — insufficient role", {
          userId: auth.userId,
          requiredRole: role,
          actualRole: userRole,
        });
        return next(ApiError.forbidden("Vous n'avez pas les droits nécessaires"));
      }

      next();
    } catch (err) {
      next(err);
    }
  });
}

/**
 * Ownership guard — ensures the authenticated user owns the resource.
 * Compares req.params.id (or a custom param) to the Clerk userId.
 * Used to prevent cross-creator data access.
 *
 * @param paramKey The URL param that holds the resource owner id (default: "id")
 */
export function requireOwnership(paramKey = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth.userId) {
      return next(ApiError.unauthorized());
    }

    const resourceId = req.params[paramKey];
    if (auth.userId !== resourceId) {
      logger.warn("Forbidden — ownership check failed", {
        userId: auth.userId,
        resourceId,
      });
      return next(ApiError.forbidden("Accès refusé à cette ressource"));
    }

    next();
  };
}

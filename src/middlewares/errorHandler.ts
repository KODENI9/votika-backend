import type { Request, Response, NextFunction } from "express";
import { isApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes in app.ts.
 *
 * Handles:
 *  - ApiError (operational) → returns the configured status and message
 *  - Generic Error → returns 500, hides stack in production
 *  - Unknown throws → returns 500
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isApiError(err)) {
    // Known, operational error — log at warn level
    logger.warn(`[${err.statusCode}] ${err.message}`);
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unexpected error — log at error level with full stack
  const message =
    err instanceof Error ? err.message : "Une erreur inattendue s'est produite";

  logger.error("Unhandled error", {
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: "Erreur interne du serveur",
    ...(env.NODE_ENV === "development" && { detail: message }),
  });
}

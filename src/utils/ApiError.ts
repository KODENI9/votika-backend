import type { Request, Response, NextFunction } from "express";

/**
 * Custom API error class.
 * Used by services and controllers to throw structured HTTP errors
 * that are caught and serialised by the global errorHandler middleware.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this);
  }

  /** 400 Bad Request */
  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  /** 401 Unauthorized */
  static unauthorized(message = "Non authentifié") {
    return new ApiError(401, message);
  }

  /** 403 Forbidden */
  static forbidden(message = "Accès refusé") {
    return new ApiError(403, message);
  }

  /** 404 Not Found */
  static notFound(message: string) {
    return new ApiError(404, message);
  }

  /** 409 Conflict */
  static conflict(message: string) {
    return new ApiError(409, message);
  }

  /** 422 Unprocessable Entity */
  static unprocessable(message: string) {
    return new ApiError(422, message);
  }

  /** 500 Internal Server Error — non-operational, will log stack */
  static internal(message = "Erreur interne du serveur") {
    return new ApiError(500, message, false);
  }
}

/** Type guard to check if an unknown error is an ApiError instance */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/**
 * Async wrapper that forwards errors from async route handlers to next().
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

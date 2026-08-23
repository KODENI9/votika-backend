import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger";

type ValidationTarget = "body" | "query" | "params";

/**
 * Generic Zod validation middleware factory.
 * Validates the specified part of the request against the given schema.
 * On failure returns 400 with a consistent error shape:
 *   { error: string, details: ZodIssue[] }
 *
 * @param schema Zod schema to validate against
 * @param target Which part of the request to validate (default: "body")
 */
export function validate<T>(schema: ZodSchema<T>, target: ValidationTarget = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const zodError = result.error as ZodError;
      logger.warn("Validation error", {
        target,
        path: req.path,
        issues: zodError.issues,
      });

      res.status(400).json({
        error: "Données invalides",
        details: zodError.issues,
      });
      return;
    }

    // Replace the request target with the parsed (and potentially transformed) value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (req as any)[target] = result.data;
    next();
  };
}

/**
 * Votika Backend — entry point
 *
 * Imports env first to trigger fail-fast validation before any other module
 * (Firebase, Clerk, etc.) attempts to use the environment variables.
 */
import { env } from "./config/env";
import app from "./app";
import { logger } from "./utils/logger";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Votika backend running on port ${PORT}`, {
    environment: env.NODE_ENV,
    port: PORT,
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`Received ${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Surface unhandled promise rejections as fatal errors
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  process.exit(1);
});

export default server;

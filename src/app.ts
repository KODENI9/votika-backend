import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkAuth } from "./middlewares/clerkAuth";
import { errorHandler } from "./middlewares/errorHandler";
import router from "./routes/index";
import { logger } from "./utils/logger";
import { env } from "./config/env";

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? process.env["FRONTEND_URL"] ?? false
        : true, // allow all origins in development
    credentials: true,
  })
);

// ─── Request logging (dev: pretty, prod: combined) ───────────────────────────
app.use(
  morgan(env.NODE_ENV === "development" ? "dev" : "combined", {
    stream: {
      write: (msg: string) => logger.info(msg.trim()),
    },
  })
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
// JSON body for all routes (webhook controller reads req.body as parsed JSON)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Clerk auth ───────────────────────────────────────────────────────────────
// Attaches auth context to every request; doesn't block unauthenticated requests
app.use(clerkAuth);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;

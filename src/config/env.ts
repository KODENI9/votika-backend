import { z } from "zod";
import dotenv from "dotenv";

// Load .env file before validation
dotenv.config();

/**
 * Zod schema for all required environment variables.
 * The server will fail fast (exit 1) if any variable is missing or invalid.
 */
const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Firebase Admin credentials
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email("FIREBASE_CLIENT_EMAIL must be a valid email"),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1, "FIREBASE_PRIVATE_KEY is required"),

  // Clerk authentication
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "CLERK_PUBLISHABLE_KEY is required"),

  // MoneyFusion payment provider
  MONEYFUSION_API_URL: z
    .string()
    .url("MONEYFUSION_API_URL must be a valid URL"),

  // Configurable defaults
  DEFAULT_VOTE_UNIT_PRICE: z.string().default("200"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  DEFAULT_VOTE_UNIT_PRICE: parseInt(parsed.data.DEFAULT_VOTE_UNIT_PRICE, 10),
  // Replace literal \n in private key (common when stored in .env as single line)
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

export type Env = typeof env;

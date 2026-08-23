import admin from "firebase-admin";
import { env } from "./env";

/**
 * Initialize Firebase Admin SDK once using service account credentials
 * from environment variables. Exported `db` is the Firestore instance
 * used throughout the application.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Private key newlines are normalised in env.ts
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
export const { FieldValue, Timestamp } = admin.firestore;
export default admin;

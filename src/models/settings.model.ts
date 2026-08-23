import type { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase";
import { env } from "../config/env";

/**
 * Firestore document shape for the `settings` collection (single doc: "config").
 * Manages campaign state and vote pricing.
 */
export interface Settings {
  voteUnitPrice: number;       // price per vote in FCFA
  campaignActive: boolean;
  campaignStartDate?: Timestamp;
  campaignEndDate?: Timestamp;
}

const COLLECTION = "settings";
const DOC_ID = "config";
const docRef = () => db.collection(COLLECTION).doc(DOC_ID);

/**
 * Get the current settings, initialising with defaults if the doc doesn't exist.
 */
export async function getSettings(): Promise<Settings> {
  const snap = await docRef().get();
  if (!snap.exists) {
    // Initialise with sensible defaults on first access
    const defaults: Settings = {
      voteUnitPrice: env.DEFAULT_VOTE_UNIT_PRICE,
      campaignActive: false,
    };
    await docRef().set(defaults);
    return defaults;
  }
  return snap.data() as Settings;
}

/**
 * Update one or more settings fields.
 * Pass null for date fields to delete them from Firestore.
 */
export async function updateSettings(
  data: Partial<{
    voteUnitPrice: number;
    campaignActive: boolean;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
  }>
): Promise<Settings> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (data.voteUnitPrice !== undefined) {
    updates["voteUnitPrice"] = data.voteUnitPrice;
  }
  if (data.campaignActive !== undefined) {
    updates["campaignActive"] = data.campaignActive;
  }
  if (data.campaignStartDate !== undefined) {
    updates["campaignStartDate"] =
      data.campaignStartDate === null
        ? FieldValue.delete()
        : data.campaignStartDate;
  }
  if (data.campaignEndDate !== undefined) {
    updates["campaignEndDate"] =
      data.campaignEndDate === null
        ? FieldValue.delete()
        : data.campaignEndDate;
  }

  await docRef().update(updates);
  return getSettings();
}

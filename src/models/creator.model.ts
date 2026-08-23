import type { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase";
import { logger } from "../utils/logger";

export type CreatorStatus = "active" | "paused" | "inactive" | "pending";

/**
 * Firestore document shape for the `creators` collection.
 * `id` mirrors the Clerk userId for registered creators.
 */
export interface Creator {
  id: string;
  displayName: string;
  tiktokHandle: string;
  bio: string;
  country: string;
  category: string;
  avatarUrl: string;
  totalVotes: number;
  status: CreatorStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTION = "creators";
const col = () => db.collection(COLLECTION);

/** Fetch a single creator by Firestore document id (= clerkUserId) */
export async function getCreatorById(id: string): Promise<Creator | null> {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Creator, "id">) };
}

/** Fetch multiple creators with optional filters */
export async function getCreators(opts: {
  status?: CreatorStatus;
  category?: string;
  country?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Creator[]> {
  let query: FirebaseFirestore.Query = col().orderBy("totalVotes", "desc");

  if (opts.status) {
    query = query.where("status", "==", opts.status);
  }
  if (opts.category) {
    query = query.where("category", "==", opts.category);
  }
  if (opts.country) {
    query = query.where("country", "==", opts.country);
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  query = query.limit(limit).offset(offset);

  const snap = await query.get();
  const creators = snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Creator)
  );

  // Firestore doesn't support full-text search; filter in-memory on displayName/handle
  if (opts.search) {
    const term = opts.search.toLowerCase();
    return creators.filter(
      (c) =>
        c.displayName.toLowerCase().includes(term) ||
        c.tiktokHandle.toLowerCase().includes(term)
    );
  }

  return creators;
}

/** Create a new creator document */
export async function createCreator(
  id: string,
  data: Omit<Creator, "id" | "createdAt" | "updatedAt" | "totalVotes">
): Promise<Creator> {
  const now = FieldValue.serverTimestamp();
  const docData = {
    ...data,
    totalVotes: 0,
    createdAt: now,
    updatedAt: now,
  };
  await col().doc(id).set(docData);
  logger.info("Creator document created", { id });
  // Return with serialisable timestamps (actual Timestamp resolved on next read)
  const created = await getCreatorById(id);
  return created!;
}

/** Update a creator document (partial) */
export async function updateCreator(
  id: string,
  data: Partial<Omit<Creator, "id" | "createdAt" | "totalVotes">>
): Promise<Creator> {
  await col()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  const updated = await getCreatorById(id);
  return updated!;
}

/** Delete a creator document */
export async function deleteCreator(id: string): Promise<void> {
  await col().doc(id).delete();
  logger.info("Creator document deleted", { id });
}

/**
 * Atomically increment the totalVotes counter for a creator.
 * Called inside a Firestore transaction from vote.service.ts.
 * Accepts a Firestore `Transaction` to compose with other writes.
 */
export function incrementVotesInTransaction(
  tx: FirebaseFirestore.Transaction,
  creatorId: string,
  voteCount: number
): void {
  const ref = col().doc(creatorId);
  tx.update(ref, {
    totalVotes: FieldValue.increment(voteCount),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

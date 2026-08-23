import type { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase";

export type VoteStatus = "pending" | "confirmed" | "failed";

/**
 * Firestore document shape for the `votes` collection.
 * One vote document is created per voting transaction initiated by a visitor.
 */
export interface Vote {
  id: string;
  creatorId: string;
  voteCount: number;       // number of votes purchased
  amount: number;          // total amount in FCFA
  transactionId: string;   // reference to the transaction doc
  voterName?: string;
  voterPhone: string;
  status: VoteStatus;
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
}

const COLLECTION = "votes";
const col = () => db.collection(COLLECTION);

/** Create a new pending vote document */
export async function createVote(
  data: Omit<Vote, "id" | "createdAt" | "confirmedAt">
): Promise<Vote> {
  const docRef = col().doc();
  const now = FieldValue.serverTimestamp();
  await docRef.set({ ...data, createdAt: now });
  const snap = await docRef.get();
  return { id: snap.id, ...snap.data() } as Vote;
}

/** Get a vote by id */
export async function getVoteById(id: string): Promise<Vote | null> {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Vote, "id">) };
}

/** Get a vote by its associated transactionId */
export async function getVoteByTransactionId(
  transactionId: string
): Promise<Vote | null> {
  const snap = await col()
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Vote;
}

/** Update vote status (and optionally confirmedAt) inside a Firestore transaction */
export function updateVoteStatusInTransaction(
  tx: FirebaseFirestore.Transaction,
  voteId: string,
  status: VoteStatus
): void {
  const ref = col().doc(voteId);
  const updates: Record<string, unknown> = { status };
  if (status === "confirmed") {
    updates["confirmedAt"] = FieldValue.serverTimestamp();
  }
  tx.update(ref, updates);
}

/** List votes for a specific creator (used in stats) */
export async function getVotesByCreatorId(
  creatorId: string,
  limit = 50
): Promise<Vote[]> {
  const snap = await col()
    .where("creatorId", "==", creatorId)
    .where("status", "==", "confirmed")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Vote));
}

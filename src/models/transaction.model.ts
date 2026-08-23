import type { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase";

export type TransactionStatus = "pending" | "success" | "failed" | "cancelled";
export type PaymentMethodType =
  | "orange"
  | "wave"
  | "mtn"
  | "flooz"
  | "mix_by_yas";

/**
 * Firestore document shape for the `transactions` collection.
 * Tracks the state of the MoneyFusion payment lifecycle.
 */
export interface Transaction {
  id: string;
  voteId: string;
  provider: "moneyfusion";
  paymentMethod: PaymentMethodType;
  amount: number;
  currency: "XOF";
  moneyFusionRef: string;   // token/reference returned by MoneyFusion on init
  status: TransactionStatus;
  rawWebhookPayload?: object; // last received webhook payload, kept for debugging
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTION = "transactions";
const col = () => db.collection(COLLECTION);

/** Create a new pending transaction document */
export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt" | "updatedAt">
): Promise<Transaction> {
  const docRef = col().doc();
  const now = FieldValue.serverTimestamp();
  await docRef.set({ ...data, createdAt: now, updatedAt: now });
  const snap = await docRef.get();
  return { id: snap.id, ...snap.data() } as Transaction;
}

/** Get a transaction by its Firestore id */
export async function getTransactionById(
  id: string
): Promise<Transaction | null> {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Transaction, "id">) };
}

/** Get a transaction by its MoneyFusion reference token */
export async function getTransactionByMoneyFusionRef(
  moneyFusionRef: string
): Promise<Transaction | null> {
  const snap = await col()
    .where("moneyFusionRef", "==", moneyFusionRef)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Transaction;
}

/**
 * Update a transaction status and optionally store the raw webhook payload.
 * Must be called inside a Firestore transaction to ensure atomicity with
 * the vote update and the creator totalVotes increment.
 */
export function updateTransactionInTransaction(
  tx: FirebaseFirestore.Transaction,
  transactionId: string,
  status: TransactionStatus,
  rawWebhookPayload?: object
): void {
  const ref = col().doc(transactionId);
  const updates: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (rawWebhookPayload) {
    updates["rawWebhookPayload"] = rawWebhookPayload;
  }
  tx.update(ref, updates);
}

/** List transactions with optional filters — for admin dashboard */
export async function listTransactions(opts: {
  status?: TransactionStatus;
  creatorId?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  let query: FirebaseFirestore.Query = col().orderBy(
    "createdAt",
    "desc"
  );

  if (opts.status) {
    query = query.where("status", "==", opts.status);
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  query = query.limit(limit).offset(offset);

  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction));
}

/** Sum of all successful transaction amounts — used in dashboard */
export async function getTotalRevenue(): Promise<number> {
  const snap = await col().where("status", "==", "success").get();
  return snap.docs.reduce(
    (sum, doc) => sum + ((doc.data() as Transaction).amount ?? 0),
    0
  );
}

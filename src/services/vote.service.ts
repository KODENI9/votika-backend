import { db } from "../config/firebase";
import { getCreatorById, incrementVotesInTransaction } from "../models/creator.model";
import { createVote, getVoteByTransactionId, getVotesByCreatorId, updateVoteStatusInTransaction } from "../models/vote.model";
import {
  createTransaction,
  getTransactionByMoneyFusionRef,
  updateTransactionInTransaction,
} from "../models/transaction.model";
import { getSettings } from "../models/settings.model";
import { moneyFusionProvider } from "../providers/payment/MoneyFusionProvider";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import type { InitiateVoteInput } from "../schemas/vote.schema";

/**
 * Vote service — orchestrates the full voting lifecycle:
 *  1. Validate campaign status + creator existence
 *  2. Calculate amount from settings
 *  3. Create vote + transaction docs (pending)
 *  4. Call MoneyFusion payin
 *  5. Handle webhook callback with Firestore transaction atomicity
 */

export interface InitiateVoteResult {
  voteId: string;
  transactionId: string;
  amount: number;
  providerRef: string;
  paymentUrl?: string;
}

/**
 * Initiate a vote: validate inputs, persist pending records, call MoneyFusion.
 */
export async function initiateVote(
  data: InitiateVoteInput,
  webhookUrl: string
): Promise<InitiateVoteResult> {
  // 1. Check campaign is active
  const settings = await getSettings();
  if (!settings.campaignActive) {
    throw ApiError.badRequest("Aucune campagne de vote n'est active pour le moment");
  }

  // 2. Check creator exists and is active
  const creator = await getCreatorById(data.creatorId);
  if (!creator) {
    throw ApiError.notFound("Créateur introuvable");
  }
  if (creator.status !== "active") {
    throw ApiError.badRequest("Ce créateur n'accepte pas de votes pour le moment");
  }

  // 3. Calculate total amount (votes × unit price)
  const voteUnitPrice = settings.voteUnitPrice;
  const totalAmount = data.voteCount * voteUnitPrice;

  logger.info("Initiating vote", {
    creatorId: data.creatorId,
    voteCount: data.voteCount,
    amount: totalAmount,
    paymentMethod: data.paymentMethod,
  });

  // 4. Create vote document (pending)
  const vote = await createVote({
    creatorId: data.creatorId,
    voteCount: data.voteCount,
    amount: totalAmount,
    transactionId: "", // will be updated after transaction creation
    voterPhone: data.voterPhone,
    voterName: data.voterName,
    status: "pending",
  });

  // 5. Call MoneyFusion payin
  let providerResult;
  try {
    providerResult = await moneyFusionProvider.initiatePayment({
      amount: totalAmount,
      currency: "XOF",
      phoneNumber: data.voterPhone,
      paymentMethod: data.paymentMethod,
      externalRef: vote.id,
      creatorId: creator.id,
      description: `${data.voteCount} vote(s) pour ${creator.displayName} sur Votika`,
      webhookUrl,
    });
  } catch (err) {
    // On payment initiation failure, mark vote as failed
    logger.error("Payment initiation failed — marking vote as failed", {
      voteId: vote.id,
      err,
    });
    throw err;
  }

  // 6. Create transaction document
  const transaction = await createTransaction({
    voteId: vote.id,
    provider: "moneyfusion",
    paymentMethod: data.paymentMethod,
    amount: totalAmount,
    currency: "XOF",
    moneyFusionRef: providerResult.providerRef,
    status: "pending",
  });

  // 7. Update vote with transactionId (best-effort; non-critical if this fails)
  try {
    await db
      .collection("votes")
      .doc(vote.id)
      .update({ transactionId: transaction.id });
  } catch (updateErr) {
    logger.warn("Failed to update vote with transactionId", {
      voteId: vote.id,
      transactionId: transaction.id,
      updateErr,
    });
  }

  return {
    voteId: vote.id,
    transactionId: transaction.id,
    amount: totalAmount,
    providerRef: providerResult.providerRef,
    paymentUrl: providerResult.paymentUrl,
  };
}

/**
 * Handle an incoming MoneyFusion webhook.
 *
 * IDEMPOTENCY: Before making any changes, we check the current transaction
 * status. If it's already `success` or `failed`, we skip all writes.
 * This ensures duplicate webhooks don't double-increment votes.
 *
 * ATOMICITY: We use a Firestore transaction to update the transaction doc,
 * the vote doc, and the creator's totalVotes counter all-or-nothing.
 */
export async function processWebhook(
  moneyFusionRef: string,
  rawStatus: string,
  payload: Record<string, unknown>
): Promise<void> {

  logger.info("Processing MoneyFusion webhook", { moneyFusionRef, rawStatus });

  // Look up the transaction by MoneyFusion reference
  const transaction = await getTransactionByMoneyFusionRef(moneyFusionRef);
  if (!transaction) {
    logger.warn("Webhook received for unknown MoneyFusion ref", { moneyFusionRef });
    return; // Silently ignore — prevents leaking existence of refs
  }

  // IDEMPOTENCY CHECK: skip if already in a terminal state
  if (transaction.status === "success" || transaction.status === "failed") {
    logger.info("Webhook already processed — skipping (idempotent)", {
      transactionId: transaction.id,
      currentStatus: transaction.status,
    });
    return;
  }

  const newTransactionStatus =
    rawStatus === "SUCCESS"
      ? "success"
      : rawStatus === "CANCELLED"
        ? "cancelled"
        : "failed";

  const newVoteStatus = newTransactionStatus === "success" ? "confirmed" : "failed";

  // Resolve the vote linked to this transaction
  const vote = await getVoteByTransactionId(transaction.id);
  if (!vote) {
    logger.error("Vote not found for transaction", { transactionId: transaction.id });
    throw ApiError.internal("Vote introuvable pour la transaction");
  }

  // ATOMIC FIRESTORE TRANSACTION: update transaction + vote + creator counter
  await db.runTransaction(async (tx) => {
    // Re-read transaction inside Firestore tx to detect concurrent updates
    const txSnap = await tx.get(db.collection("transactions").doc(transaction.id));
    const currentTxStatus = (txSnap.data() as { status: string } | undefined)?.status;

    // Double-check idempotency inside the Firestore transaction
    if (currentTxStatus === "success" || currentTxStatus === "failed") {
      logger.info("Transaction already finalised (concurrent webhook) — aborting tx", {
        transactionId: transaction.id,
      });
      return;
    }

    updateTransactionInTransaction(tx, transaction.id, newTransactionStatus, payload);

    // 2. Update vote status
    updateVoteStatusInTransaction(tx, vote.id, newVoteStatus);

    // 3. If payment succeeded, increment creator's vote counter
    if (newTransactionStatus === "success") {
      incrementVotesInTransaction(tx, vote.creatorId, vote.voteCount);
      logger.info("Vote confirmed — incrementing creator totalVotes", {
        creatorId: vote.creatorId,
        voteCount: vote.voteCount,
      });
    }
  });

  logger.info("Webhook processed successfully", {
    transactionId: transaction.id,
    voteId: vote.id,
    newStatus: newTransactionStatus,
  });
}

/** Creator stats — votes received and revenue generated */
export interface CreatorStats {
  totalVotes: number;
  totalRevenue: number;
  recentVotes: Array<{
    voteCount: number;
    amount: number;
    createdAt: FirebaseFirestore.Timestamp;
  }>;
}

export async function getCreatorStats(creatorId: string): Promise<CreatorStats> {
  const [creator, votes] = await Promise.all([
    getCreatorById(creatorId),
    getVotesByCreatorId(creatorId, 50),
  ]);

  if (!creator) throw ApiError.notFound("Créateur introuvable");

  const totalRevenue = votes.reduce((sum, v) => sum + v.amount, 0);

  return {
    totalVotes: creator.totalVotes,
    totalRevenue,
    recentVotes: votes.map((v) => ({
      voteCount: v.voteCount,
      amount: v.amount,
      createdAt: v.createdAt,
    })),
  };
}

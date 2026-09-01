import type { Request, Response } from "express";
import { initiateVote, processWebhook } from "../services/vote.service";
import type { InitiateVoteInput } from "../schemas/vote.schema";
import { asyncHandler, ApiError } from "../utils/ApiError";
import { getVoteById } from "../models/vote.model";
import { getTransactionById } from "../models/transaction.model";
import { moneyFusionProvider } from "../providers/payment/MoneyFusionProvider";

/**
 * Vote controller — handles vote initiation for anonymous visitors.
 */

/** POST /api/votes — initiate a vote payment */
export const createVote = asyncHandler(async (req: Request, res: Response) => {
  const webhookUrl = "https://votika-backend.fly.dev/api/webhooks/moneyfusion";
  // Log it to be sure
  console.log("Initiating vote with webhookUrl:", webhookUrl);

  const result = await initiateVote(req.body as InitiateVoteInput, webhookUrl);

  res.status(201).json({
    data: {
      voteId: result.voteId,
      transactionId: result.transactionId,
      amount: result.amount,
      providerRef: result.providerRef,
      paymentUrl: result.paymentUrl,
      message: "Paiement initié. Veuillez compléter le paiement sur votre téléphone.",
    },
  });
});

/** GET /api/votes/:voteId/status — check the payment status */
export const getVoteStatus = asyncHandler(async (req: Request, res: Response) => {
  const { voteId } = req.params;
  let vote = await getVoteById(voteId);
  const tokenFromQuery = req.query.token as string | undefined;

  if (!vote) {
    throw ApiError.notFound("Vote introuvable");
  }

  // FALLBACK: If vote is still pending, actively query MoneyFusion
  if (vote.status === "pending") {
    try {
      // Find the token either from query params or from the transaction directly
      let tokenToVerify = tokenFromQuery;
      if (!tokenToVerify && vote.transactionId) {
        const transaction = await getTransactionById(vote.transactionId);
        if (transaction) {
          tokenToVerify = transaction.moneyFusionRef;
        }
      }

      if (tokenToVerify) {
        const verification = await moneyFusionProvider.verifyPayment(tokenToVerify);
        if (verification.status === "success" || verification.status === "failed") {
          const finalStatus = verification.status === "success" ? "SUCCESS" : "FAILED";
          // Force the webhook processing locally to update the vote and creator stats
          await processWebhook(tokenToVerify, finalStatus, { _source: "polling_fallback", status: verification.status });
          // Re-fetch the updated vote
          const updatedVote = await getVoteById(voteId);
          if (updatedVote) vote = updatedVote;
        }
      }
    } catch (err) {
      console.error("Fallback MoneyFusion verification failed:", err);
    }
  }

  const status =
    vote.status === "confirmed"
      ? "SUCCESS"
      : vote.status === "failed"
        ? "FAILED"
        : "PENDING";

  // When frontend uses apiClient it un-nests data, but since we wrap it in data:
  res.status(200).json({
    data: {
      status,
      votesAdded: vote.status === "confirmed" ? vote.voteCount : undefined,
    }
  });
});

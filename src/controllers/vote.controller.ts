import type { Request, Response } from "express";
import { initiateVote } from "../services/vote.service";
import type { InitiateVoteInput } from "../schemas/vote.schema";
import { asyncHandler } from "../utils/ApiError";
import { env } from "../config/env";

/**
 * Vote controller — handles vote initiation for anonymous visitors.
 */

/** POST /api/votes — initiate a vote payment */
export const createVote = asyncHandler(async (req: Request, res: Response) => {
  // Build the webhook URL dynamically from the request host.
  // In production, use an explicit env variable or a fixed domain.
  const protocol = req.secure ? "https" : req.protocol;
  const host = req.get("host") ?? `localhost:${env.PORT}`;
  const webhookUrl = `${protocol}://${host}/api/webhooks/moneyfusion`;

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

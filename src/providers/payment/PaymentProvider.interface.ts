import type { PaymentMethodType } from "../../models/transaction.model";

/**
 * Generic contract for a payment provider.
 * All providers (MoneyFusion today, Stripe/Paystack tomorrow) must implement this.
 * This allows swapping providers without touching the service layer.
 */
export interface InitiatePaymentParams {
  amount: number;
  currency: string;
  phoneNumber: string;
  paymentMethod: PaymentMethodType;
  /** External reference (e.g. voteId) stored with the transaction for reconciliation */
  externalRef: string;
  /** Creator ID associated with the vote */
  creatorId: string;
  /** Short description shown to the payer on their phone */
  description: string;
  /** URL MoneyFusion calls when payment status changes */
  webhookUrl: string;
}

export interface InitiatePaymentResult {
  /** Provider-specific reference/token (stored as moneyFusionRef) */
  providerRef: string;
  /** URL to redirect the user to complete payment (if applicable) */
  paymentUrl?: string;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "pending" | "cancelled";
  amount?: number;
  providerRef: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  /**
   * Initiate a Mobile Money payment via the provider.
   * Returns a reference and optional redirect URL.
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Verify the status of a payment using the provider reference.
   * Used as a fallback when a webhook is missed.
   */
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>;

  /**
   * Validate the authenticity of an incoming webhook payload.
   * Returns true if the payload is genuine (signature matches).
   */
  validateWebhook(payload: unknown, signature: string): boolean;
}

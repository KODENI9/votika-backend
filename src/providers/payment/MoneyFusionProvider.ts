import axios, { type AxiosInstance } from "axios";

import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { ApiError } from "../../utils/ApiError";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "./PaymentProvider.interface";





/** Raw webhook body sent by MoneyFusion */
export interface MoneyFusionWebhookPayload {
  tokenPay?: string;
  token?: string;
  event?: string;
  status?: string;
  personal_Info?: Array<{ voteId?: string; creatorId?: string }>;
}

/**
 * MoneyFusion payment provider implementation.
 * Handles payin initiation and webhook validation for Mobile Money payments
 * in West Africa (Orange Money, Wave, MTN, Flooz, Mix by Yas).
 */
export class MoneyFusionProvider implements PaymentProvider {
  private readonly client: AxiosInstance;
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = env.MONEYFUSION_API_URL;
    if (!this.apiUrl) {
      throw new Error("MONEYFUSION_API_URL is missing");
    }

    this.client = axios.create({
      baseURL: "", // We will use the full URL in the post request
      timeout: 10000,
    });

    // Request interceptor for logging outgoing calls
    this.client.interceptors.request.use((config) => {
      logger.debug("MoneyFusion outgoing request", {
        method: config.method,
        url: config.url,
      });
      return config;
    });

    // Response interceptor for logging errors
    this.client.interceptors.response.use(
      (res) => res,
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          logger.error("MoneyFusion API error", {
            status: err.response?.status,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: err.response?.data,
            message: err.message,
          });
        }
        return Promise.reject(err);
      }
    );
  }

  /**
   * Initiate a Mobile Money payin request.
   * Maps our internal payment method names to MoneyFusion's format.
   * Includes a single retry on network/5xx errors.
   */
  async initiatePayment(
    params: InitiatePaymentParams
  ): Promise<InitiatePaymentResult> {

    let lastError: unknown;

    // Retry once on transient errors (5xx or network timeout)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await this.client.post<{
          statut?: boolean;
          success?: boolean; // Keep for backward compatibility
          token: string;
          message?: string;
          url?: string;
          payment_url?: string; // Keep for backward compatibility
        }>(this.apiUrl, {
          totalPrice: params.amount,
          numeroSend: params.phoneNumber,
          nomclient: "Votant Anonyme",
          article: [{ vote: params.amount }],
          personal_Info: [{ voteId: params.externalRef, creatorId: params.creatorId }],
          webhook_url: params.webhookUrl,
          return_url: "https://votika.com/vote/confirmation", // Can be dynamic if needed
        });

        if (res.data.statut === false && res.data.success === false) {
          throw ApiError.badRequest(
            res.data.message ?? "MoneyFusion: paiement refusé"
          );
        }

        logger.info("MoneyFusion payin initiated", {
          token: res.data.token,
          externalRef: params.externalRef,
        });

        return {
          providerRef: res.data.token,
          paymentUrl: res.data.url ?? res.data.payment_url ?? "",
          metadata: { moneyFusionResponse: res.data },
        };
      } catch (err: unknown) {
        lastError = err;

        // Do not retry on client/business errors
        if (err instanceof ApiError) break;
        if (axios.isAxiosError(err) && err.response && err.response.status < 500)
          break;

        if (attempt < 2) {
          logger.warn(`MoneyFusion payin failed — retrying (attempt ${attempt})`, {
            error: err instanceof Error ? err.message : String(err),
          });
          // Small exponential back-off: 500ms before retry
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    throw lastError instanceof ApiError
      ? lastError
      : ApiError.internal("Erreur de connexion avec MoneyFusion");
  }

  /**
   * Verify the status of a payment by polling MoneyFusion.
   * Useful as a fallback.
   */
  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const res = await axios.get<{
      statut?: boolean;
      status?: string;
      event?: string;
      amount?: number;
      totalPrice?: number;
    }>(
      `https://www.pay.moneyfusion.net/paiementNotif/${providerRef}`
    );

    // Adapting to whatever the status field is, fallback to success if statut is true
    const isSuccess = res.data.statut === true || res.data.status === "SUCCESS" || res.data.event === "payin.session.completed";
    
    return {
      status: isSuccess ? "success" : "failed",
      amount: res.data.amount || res.data.totalPrice || 0,
      providerRef: providerRef,
    };
  }

  /**
   * Validate the authenticity of an incoming webhook payload.
   * MoneyFusion doesn't provide a signature, so we return true
   * and rely on verifyPayment (GET request) to ensure authenticity.
   */
  validateWebhook(_payload: unknown, _signature: string): boolean {
    return true;
  }
}

/** Singleton instance — reuse the same axios client across requests */
export const moneyFusionProvider = new MoneyFusionProvider();

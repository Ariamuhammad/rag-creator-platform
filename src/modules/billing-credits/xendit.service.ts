import { Injectable, Logger } from '@nestjs/common';
import { Xendit } from 'xendit-node';

export interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  customerName?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

export interface InvoiceResult {
  id: string;
  externalId: string;
  invoiceUrl: string;
  status: string;
  amount: number;
  expiryDate?: string;
  isSimulated?: boolean;
}

export interface CreatePayoutParams {
  referenceId: string;
  channelCode: string; // e.g. BCA, MANDIRI, BRI, BNI, OVO, DANA
  channelProperties: {
    accountNumber: string;
    accountHolderName: string;
  };
  amount: number;
  description: string;
}

export interface PayoutResult {
  id: string;
  referenceId: string;
  status: string;
  amount: number;
  isSimulated?: boolean;
}

@Injectable()
export class XenditService {
  private readonly logger = new Logger(XenditService.name);
  private xenditClient: Xendit | null = null;
  private readonly webhookToken: string;
  private readonly isMockMode: boolean;

  constructor() {
    const secretKey = process.env.XENDIT_SECRET_KEY || '';
    this.webhookToken =
      process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN ||
      'rag_xendit_webhook_token_secret';

    const isPlaceholderKey =
      !secretKey ||
      secretKey.includes('placeholder') ||
      !secretKey.startsWith('xnd_');

    if (isPlaceholderKey) {
      this.logger.warn(
        'Xendit secret key is missing or placeholder. Running XenditService in SIMULATION/SANDBOX mode.',
      );
      this.isMockMode = true;
    } else {
      try {
        this.xenditClient = new Xendit({ secretKey });
        this.isMockMode = false;
        this.logger.log(
          'Xendit SDK initialized successfully with real API credentials.',
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to initialize Xendit SDK: ${err?.message}. Falling back to simulation mode.`,
        );
        this.isMockMode = true;
      }
    }
  }

  /**
   * Verify callback token from incoming Xendit webhook request (header: x-callback-token).
   */
  verifyWebhookToken(receivedToken?: string): boolean {
    if (!this.webhookToken) {
      return true;
    }
    return receivedToken === this.webhookToken;
  }

  /**
   * Create payment invoice for student subscription via Xendit API.
   */
  async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
    const successRedirectUrl =
      params.successRedirectUrl ||
      process.env.XENDIT_SUCCESS_REDIRECT_URL ||
      'http://localhost:3000/billing/success';
    const failureRedirectUrl =
      params.failureRedirectUrl ||
      process.env.XENDIT_FAILURE_REDIRECT_URL ||
      'http://localhost:3000/billing/failed';

    if (!this.isMockMode && this.xenditClient) {
      try {
        this.logger.log(
          `Calling Xendit API to create invoice for ${params.externalId} (amount: Rp ${params.amount})`,
        );

        const response = await this.xenditClient.Invoice.createInvoice({
          data: {
            externalId: params.externalId,
            amount: params.amount,
            payerEmail: params.payerEmail,
            description: params.description,
            invoiceDuration: 86400, // 24 hours in seconds (number)
            successRedirectUrl,
            failureRedirectUrl,
            customer: params.customerName
              ? {
                  givenNames: params.customerName,
                  email: params.payerEmail,
                }
              : undefined,
          },
        });

        return {
          id: response.id || `inv_${Date.now()}`,
          externalId: response.externalId || params.externalId,
          invoiceUrl:
            response.invoiceUrl ||
            `https://checkout.xendit.co/web/${response.id}`,
          status: response.status || 'PENDING',
          amount: Number(response.amount || params.amount),
          expiryDate: response.expiryDate
            ? new Date(response.expiryDate).toISOString()
            : undefined,
          isSimulated: false,
        };
      } catch (error: any) {
        this.logger.error(
          `Xendit API createInvoice failed: ${error?.message || error}. Falling back to simulation response.`,
        );
        // Fallback to simulated response if remote network fails during testing
      }
    }

    // Simulated sandbox response for local development & tests
    const simulatedInvoiceId = `inv_sim_${Date.now()}`;
    return {
      id: simulatedInvoiceId,
      externalId: params.externalId,
      invoiceUrl: `https://checkout-staging.xendit.co/web/${simulatedInvoiceId}`,
      status: 'PENDING',
      amount: params.amount,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isSimulated: true,
    };
  }

  /**
   * Request payout / disbursement to Creator bank account.
   */
  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    if (!this.isMockMode && this.xenditClient && this.xenditClient.Payout) {
      try {
        const response = await this.xenditClient.Payout.createPayout({
          idempotencyKey: params.referenceId,
          data: {
            referenceId: params.referenceId,
            channelCode: params.channelCode.toUpperCase(),
            channelProperties: {
              accountNumber: params.channelProperties.accountNumber,
              accountHolderName: params.channelProperties.accountHolderName,
            },
            amount: params.amount,
            currency: 'IDR',
            description: params.description,
          },
        });

        return {
          id: response.id || `disb_${Date.now()}`,
          referenceId: response.referenceId || params.referenceId,
          status: response.status || 'PENDING',
          amount: Number(response.amount || params.amount),
          isSimulated: false,
        };
      } catch (error: any) {
        this.logger.error(
          `Xendit API createPayout failed: ${error?.message || error}. Returning simulated payout.`,
        );
      }
    }

    // Simulated payout response
    return {
      id: `disb_sim_${Date.now()}`,
      referenceId: params.referenceId,
      status: 'PENDING',
      amount: params.amount,
      isSimulated: true,
    };
  }
}

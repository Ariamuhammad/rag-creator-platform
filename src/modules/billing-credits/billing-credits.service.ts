import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreditEventType,
  SubscriptionStatus,
  PaymentStatus,
  PayoutStatus,
} from '../../common/types/enums';
import { XenditService } from './xendit.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';

@Injectable()
export class BillingCreditsService {
  private readonly logger = new Logger(BillingCreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xenditService: XenditService,
  ) {}

  /**
   * Validates that the student has an active subscription and sufficient credits.
   */
  async validateCreditAvailability(
    studentId: string,
    creatorProfileId: string,
    minimumRequired = 50,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        studentId,
        creatorProfileId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gte: new Date() },
      },
    });

    if (!subscription) {
      throw new ForbiddenException(
        'No active subscription found for this creator. Please subscribe to continue.',
      );
    }

    if (subscription.remainingCredits < minimumRequired) {
      throw new ForbiddenException(
        `Insufficient token credits (${subscription.remainingCredits} remaining). Please upgrade your tier or wait for quota renewal.`,
      );
    }

    return subscription;
  }

  /**
   * Atomically deducts token credits and logs to CreditLedger.
   */
  async deductTokens(
    studentId: string,
    creatorProfileId: string,
    chatSessionId: string,
    promptTokens: number,
    completionTokens: number,
  ) {
    const totalTokens = promptTokens + completionTokens;

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch current active subscription
      const subscription = await tx.subscription.findFirst({
        where: {
          studentId,
          creatorProfileId,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (!subscription) {
        throw new ForbiddenException('Active subscription not found.');
      }

      // Ensure credits don't drop below zero
      const newRemaining = Math.max(
        0,
        subscription.remainingCredits - totalTokens,
      );

      // 2. Decrement remaining credits
      const updatedSub = await tx.subscription.update({
        where: { id: subscription.id },
        data: { remainingCredits: newRemaining },
      });

      // 3. Create CreditLedger entry
      const ledgerEntry = await tx.creditLedger.create({
        data: {
          studentId,
          creatorProfileId,
          chatSessionId,
          promptTokens,
          completionTokens,
          totalTokens,
          creditsDeducted: totalTokens,
          eventType: CreditEventType.CHAT_QUERY,
          notes: `RAG Copilot query: ${promptTokens} prompt + ${completionTokens} completion tokens.`,
        },
      });

      this.logger.log(
        `Deducted ${totalTokens} tokens for student ${studentId} (Remaining: ${newRemaining})`,
      );

      return {
        ledgerId: ledgerEntry.id,
        creditsDeducted: totalTokens,
        remainingCredits: updatedSub.remainingCredits,
      };
    });
  }

  /**
   * APPROACH 2: Creates a Xendit payment invoice for student subscription.
   * Calculates platform fee (20%) and creator earnings (80%).
   */
  async createPaymentInvoice(studentId: string, dto: CreateInvoiceDto) {
    // 1. Verify creator & tier
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: dto.creatorProfileId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    const tier = await this.prisma.subscriptionTier.findUnique({
      where: { id: dto.tierId },
    });
    if (!tier || tier.creatorProfileId !== dto.creatorProfileId || !tier.isActive) {
      throw new NotFoundException('Subscription tier not found or inactive.');
    }

    // 2. Fetch student user for payer details
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student user not found.');
    }

    // 3. Calculate 80/20 revenue split
    const priceNumber = Number(tier.price);
    const platformCommissionPercent = creator.commissionRate || 0.20; // Default 20%
    const platformFee = Math.round(priceNumber * platformCommissionPercent);
    const creatorEarnings = priceNumber - platformFee;

    // 4. Generate external order ID
    const externalId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5. Create invoice via Xendit API
    const invoiceResult = await this.xenditService.createInvoice({
      externalId,
      amount: priceNumber,
      payerEmail: student.email,
      customerName: student.fullName || 'Student',
      description: `Subscription: ${tier.name} by ${creator.displayName}`,
    });

    // 6. Save PaymentOrder in database
    const order = await this.prisma.paymentOrder.create({
      data: {
        externalId,
        xenditInvoiceId: invoiceResult.id,
        studentId,
        creatorProfileId: dto.creatorProfileId,
        tierId: dto.tierId,
        amount: priceNumber,
        platformFee,
        creatorEarnings,
        status: PaymentStatus.PENDING,
        invoiceUrl: invoiceResult.invoiceUrl,
      },
    });

    this.logger.log(
      `Created payment order ${order.id} (externalId: ${externalId}) for Rp ${priceNumber}. Platform: Rp ${platformFee}, Creator: Rp ${creatorEarnings}`,
    );

    return {
      message: 'Invoice created successfully.',
      orderId: order.id,
      externalId,
      invoiceUrl: invoiceResult.invoiceUrl,
      amount: priceNumber,
      platformFee,
      creatorEarnings,
      expiryDate: invoiceResult.expiryDate,
      isSimulated: invoiceResult.isSimulated,
    };
  }

  /**
   * APPROACH 2: Handles Xendit Webhook notifications.
   * When PAID: Activates subscription, grants monthly token credits,
   * and automatically credits 80% to the Creator's wallet.
   */
  async handleXenditWebhook(payload: any, callbackToken?: string) {
    // 1. Verify webhook authenticity
    if (!this.xenditService.verifyWebhookToken(callbackToken)) {
      this.logger.error('Unauthorized webhook call: invalid x-callback-token');
      throw new UnauthorizedException('Invalid callback token.');
    }

    const externalId = payload.external_id || payload.externalId;
    const status = (payload.status || '').toUpperCase();
    const paymentMethod =
      payload.payment_method || payload.payment_channel || payload.paymentChannel || 'XENDIT';

    if (!externalId) {
      throw new BadRequestException('Webhook payload missing external_id.');
    }

    this.logger.log(
      `Received Xendit webhook for externalId=${externalId}, status=${status}, method=${paymentMethod}`,
    );

    // 2. Find matching payment order
    const order = await this.prisma.paymentOrder.findUnique({
      where: { externalId },
      include: { tier: true, creatorProfile: true },
    });

    if (!order) {
      this.logger.warn(`Payment order not found for externalId: ${externalId}`);
      throw new NotFoundException(`Payment order not found for externalId: ${externalId}`);
    }

    // 3. Check if already processed
    if (order.status === PaymentStatus.PAID) {
      return {
        message: 'Order already processed as PAID.',
        orderId: order.id,
        status: PaymentStatus.PAID,
      };
    }

    // 4. Handle PAID or SETTLED event
    if (status === 'PAID' || status === 'SETTLED') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30-day billing cycle

      return this.prisma.$transaction(async (tx) => {
        // A. Update payment order
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            xenditPaymentMethod: paymentMethod,
          },
        });

        // B. Expire any existing active subscription for this student & creator
        await tx.subscription.updateMany({
          where: {
            studentId: order.studentId,
            creatorProfileId: order.creatorProfileId,
            status: SubscriptionStatus.ACTIVE,
          },
          data: { status: SubscriptionStatus.EXPIRED },
        });

        // C. Create new active subscription
        const subscription = await tx.subscription.create({
          data: {
            studentId: order.studentId,
            creatorProfileId: order.creatorProfileId,
            tierId: order.tierId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            remainingCredits: order.tier.monthlyCreditQuota,
          },
        });

        // D. Record token credit grant in CreditLedger
        await tx.creditLedger.create({
          data: {
            studentId: order.studentId,
            creatorProfileId: order.creatorProfileId,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            creditsDeducted: -order.tier.monthlyCreditQuota,
            eventType: CreditEventType.SUBSCRIPTION_GRANT,
            notes: `Quota granted via Xendit Payment (${order.externalId}) for tier ${order.tier.name} (${order.tier.monthlyCreditQuota} tokens)`,
          },
        });

        // E. APPROACH 2 CORE: Increment Creator's Wallet Balance (80% net earnings)
        const currentCreator = await tx.creatorProfile.findUnique({
          where: { id: order.creatorProfileId },
        });
        const currentBalance = Number(currentCreator?.walletBalance || 0);
        const newBalance = currentBalance + Number(order.creatorEarnings);

        await tx.creatorProfile.update({
          where: { id: order.creatorProfileId },
          data: {
            walletBalance: newBalance,
          },
        });

        this.logger.log(
          `Payment fulfilled for order ${order.id}. Creator ${order.creatorProfileId} wallet credited with Rp ${order.creatorEarnings} (New balance: Rp ${newBalance})`,
        );

        return {
          message: 'Payment processed and subscription activated successfully.',
          orderId: order.id,
          subscriptionId: subscription.id,
          creatorWalletCredited: order.creatorEarnings,
          newWalletBalance: newBalance,
        };
      });
    }

    // 5. Handle EXPIRED / FAILED events
    if (status === 'EXPIRED') {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentStatus.EXPIRED },
      });
      return { message: 'Order marked as EXPIRED.', orderId: order.id };
    }

    if (status === 'FAILED') {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentStatus.FAILED },
      });
      return { message: 'Order marked as FAILED.', orderId: order.id };
    }

    return { message: `Webhook received with status ${status}.`, orderId: order.id };
  }

  /**
   * Direct subscribe without payment (kept for testing or free tier / admin grants).
   */
  async subscribeToTier(
    studentId: string,
    creatorProfileId: string,
    tierId: string,
  ) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    const tier = await this.prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });
    if (!tier || tier.creatorProfileId !== creatorProfileId || !tier.isActive) {
      throw new NotFoundException('Subscription tier not found or inactive.');
    }

    const priceNumber = Number(tier.price);
    const platformCommissionPercent = creator.commissionRate;
    const platformFee = priceNumber * platformCommissionPercent;
    const creatorEarnings = priceNumber - platformFee;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          studentId,
          creatorProfileId,
          status: SubscriptionStatus.ACTIVE,
        },
        data: { status: SubscriptionStatus.EXPIRED },
      });

      const subscription = await tx.subscription.create({
        data: {
          studentId,
          creatorProfileId,
          tierId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          remainingCredits: tier.monthlyCreditQuota,
        },
        include: { tier: true },
      });

      await tx.creditLedger.create({
        data: {
          studentId,
          creatorProfileId,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          creditsDeducted: -tier.monthlyCreditQuota,
          eventType: CreditEventType.SUBSCRIPTION_GRANT,
          notes: `Monthly quota granted for tier ${tier.name} (${tier.monthlyCreditQuota} tokens)`,
        },
      });

      // Also credit creator wallet in direct tier subscription
      if (creatorEarnings > 0) {
        const currentBalance = Number(creator.walletBalance || 0);
        await tx.creatorProfile.update({
          where: { id: creatorProfileId },
          data: { walletBalance: currentBalance + creatorEarnings },
        });
      }

      return {
        message: 'Subscription created successfully.',
        subscription,
        financialSummary: {
          price: priceNumber,
          platformFee,
          creatorEarnings,
          monthlyCredits: tier.monthlyCreditQuota,
          expiresAt: endDate,
        },
      };
    });
  }

  /**
   * Gets student balance & subscription details for a specific creator.
   */
  async getStudentBalance(studentId: string, creatorProfileId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        studentId,
        creatorProfileId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        tier: true,
      },
    });

    return {
      hasActiveSubscription: !!subscription,
      subscription: subscription || null,
      remainingCredits: subscription?.remainingCredits || 0,
    };
  }

  /**
   * Gets student's payment order history.
   */
  async getStudentOrders(studentId: string) {
    return this.prisma.paymentOrder.findMany({
      where: { studentId },
      include: {
        creatorProfile: {
          select: { displayName: true, slug: true },
        },
        tier: {
          select: { name: true, price: true, monthlyCreditQuota: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Gets ledger audit history for a student.
   */
  async getLedgerHistory(studentId: string, creatorProfileId: string) {
    return this.prisma.creditLedger.findMany({
      where: {
        studentId,
        creatorProfileId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * CREATOR WALLET: View current wallet balance, bank details, and revenue share.
   */
  async getCreatorWallet(userId: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    const recentOrders = await this.prisma.paymentOrder.findMany({
      where: {
        creatorProfileId: creator.id,
        status: PaymentStatus.PAID,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentPayouts = await this.prisma.payoutRequest.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      creatorProfileId: creator.id,
      displayName: creator.displayName,
      walletBalance: Number(creator.walletBalance || 0),
      commissionRate: creator.commissionRate, // e.g. 0.20 (20% platform)
      creatorSharePercent: Math.round((1 - creator.commissionRate) * 100), // e.g. 80%
      bankAccount: {
        bankName: creator.bankName,
        bankAccountNumber: creator.bankAccountNumber,
        bankAccountHolderName: creator.bankAccountHolderName,
        isConfigured: !!(
          creator.bankName &&
          creator.bankAccountNumber &&
          creator.bankAccountHolderName
        ),
      },
      recentEarnings: recentOrders,
      recentPayouts,
    };
  }

  /**
   * CREATOR WALLET: Update payout destination bank account details.
   */
  async updateCreatorBankAccount(userId: string, dto: UpdateBankAccountDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    const updated = await this.prisma.creatorProfile.update({
      where: { id: creator.id },
      data: {
        bankName: dto.bankName.toUpperCase().trim(),
        bankAccountNumber: dto.bankAccountNumber.trim(),
        bankAccountHolderName: dto.bankAccountHolderName.trim(),
      },
    });

    return {
      message: 'Bank account updated successfully.',
      bankAccount: {
        bankName: updated.bankName,
        bankAccountNumber: updated.bankAccountNumber,
        bankAccountHolderName: updated.bankAccountHolderName,
      },
    };
  }

  /**
   * CREATOR WALLET: Request payout/withdrawal from accumulated wallet balance.
   */
  async requestPayout(userId: string, dto: RequestPayoutDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    if (
      !creator.bankName ||
      !creator.bankAccountNumber ||
      !creator.bankAccountHolderName
    ) {
      throw new BadRequestException(
        'Please configure your bank account details before requesting a payout.',
      );
    }

    const currentBalance = Number(creator.walletBalance || 0);
    if (currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient wallet balance (Current: Rp ${currentBalance.toLocaleString('id-ID')}, Requested: Rp ${dto.amount.toLocaleString('id-ID')}).`,
      );
    }

    const fee = 0; // Standard transfer fee (can be adjusted)
    const netAmount = dto.amount - fee;

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct requested amount from creator wallet
      const newBalance = currentBalance - dto.amount;
      await tx.creatorProfile.update({
        where: { id: creator.id },
        data: { walletBalance: newBalance },
      });

      // 2. Create PayoutRequest
      const payout = await tx.payoutRequest.create({
        data: {
          creatorProfileId: creator.id,
          amount: dto.amount,
          fee,
          netAmount,
          bankName: creator.bankName!,
          bankAccountNumber: creator.bankAccountNumber!,
          bankAccountHolderName: creator.bankAccountHolderName!,
          status: PayoutStatus.PENDING,
          notes: dto.notes || null,
        },
      });

      this.logger.log(
        `Creator ${creator.displayName} requested payout of Rp ${dto.amount}. Remaining balance: Rp ${newBalance}`,
      );

      return {
        message: 'Payout request submitted successfully. Awaiting processing.',
        payoutId: payout.id,
        amount: dto.amount,
        netAmount,
        destination: {
          bankName: creator.bankName,
          accountNumber: creator.bankAccountNumber,
          holderName: creator.bankAccountHolderName,
        },
        remainingWalletBalance: newBalance,
      };
    });
  }

  /**
   * CREATOR WALLET: View payout history for the authenticated creator.
   */
  async getPayoutHistory(userId: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    return this.prisma.payoutRequest.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

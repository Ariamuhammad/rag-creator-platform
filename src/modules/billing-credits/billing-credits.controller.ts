import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { BillingCreditsService } from './billing-credits.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Billing & Token Credits')
@Controller('billing')
export class BillingCreditsController {
  constructor(private readonly billingService: BillingCreditsService) {}

  /**
   * ==========================================
   * STUDENT PAYMENT & INVOICE FLOW (XENDIT)
   * ==========================================
   */

  @Post('create-invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate Xendit payment invoice for student subscription (Approach 2)',
    description:
      'Creates a pending payment order and returns Xendit checkout invoice URL. Platform fee (20%) and Creator earnings (80%) are automatically calculated.',
  })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully.' })
  async createInvoice(
    @CurrentUser('id') studentId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.billingService.createPaymentInvoice(studentId, dto);
  }

  @Post('xendit-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public webhook receiver for Xendit payment notifications',
    description:
      'Receives callback from Xendit when invoice is PAID. Automatically activates subscription, grants token credits, and deposits 80% net earnings into Creator wallet balance.',
  })
  @ApiHeader({
    name: 'x-callback-token',
    required: false,
    description: 'Xendit webhook verification token',
  })
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-callback-token') callbackToken?: string,
  ) {
    return this.billingService.handleXenditWebhook(payload, callbackToken);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment order history for the authenticated student',
  })
  async getOrders(@CurrentUser('id') studentId: string) {
    return this.billingService.getStudentOrders(studentId);
  }

  /**
   * ==========================================
   * CREATOR WALLET & PAYOUT FLOW (APPROACH 2)
   * ==========================================
   */

  @Get('creator/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View creator wallet balance, revenue share details, and bank info',
    description:
      'Returns current accumulated wallet balance (80% net earnings), configured bank details, and recent earnings/payouts.',
  })
  async getCreatorWallet(@CurrentUser('id') userId: string) {
    return this.billingService.getCreatorWallet(userId);
  }

  @Patch('creator/bank-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Configure or update payout destination bank account details',
  })
  async updateBankAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.billingService.updateCreatorBankAccount(userId, dto);
  }

  @Post('creator/payout-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request payout/withdrawal from creator wallet balance',
    description:
      'Deducts amount from walletBalance and creates a PayoutRequest (status PENDING) for processing to creator bank account.',
  })
  async requestPayout(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.billingService.requestPayout(userId, dto);
  }

  @Get('creator/payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View all payout requests and withdrawal history for creator',
  })
  async getPayouts(@CurrentUser('id') userId: string) {
    return this.billingService.getPayoutHistory(userId);
  }

  /**
   * ==========================================
   * DIRECT SUBSCRIPTION & AUDIT (LEGACY/FALLBACK)
   * ==========================================
   */

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Directly subscribe to a Creator tier (admin/test grant)',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created and token credits allocated.',
  })
  async subscribe(
    @CurrentUser('id') studentId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.billingService.subscribeToTier(
      studentId,
      dto.creatorProfileId,
      dto.tierId,
    );
  }

  @Get('balance/:creatorProfileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check remaining token credit balance for a specific Creator',
  })
  async getBalance(
    @CurrentUser('id') studentId: string,
    @Param('creatorProfileId') creatorProfileId: string,
  ) {
    return this.billingService.getStudentBalance(studentId, creatorProfileId);
  }

  @Get('history/:creatorProfileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View Token Credit Ledger audit history for a specific Creator',
  })
  async getHistory(
    @CurrentUser('id') studentId: string,
    @Param('creatorProfileId') creatorProfileId: string,
  ) {
    return this.billingService.getLedgerHistory(studentId, creatorProfileId);
  }
}
